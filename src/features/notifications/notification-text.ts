import i18n, { type TFunction } from 'i18next'

import { intlLocale } from '@/i18n/intl-locale'
import type { es } from '@/i18n/locales/es'
import { formatDateTime, formatMoney } from '@/lib/format'

/**
 * The API stores each notification's text once, already written in English, and has no field for the figures in it.
 * So the text shown is rebuilt here from the type, in the language the user chose, with the figures read back out
 * of the stored body. That also covers notifications saved before this existed. When a body doesn't match what the
 * API writes (it changed, say) the notice falls back to a version without figures rather than to English.
 */
type Keys = { titleKey?: 'titleReset'; bodyKey: 'body' | 'bodyCredit' | 'bodyDebit' | 'bodyGeneric' | 'bodyOne' | 'bodyReset' | 'bodySupport'; values?: Record<string, string> }

const AMOUNT = String.raw`(\d+(?:\.\d+)?) ([A-Z]{3})`

// The name the API writes when it can't find the sender, which never happens in practice
const UNKNOWN_SENDER = 'another Digital Wallet user'

function money(amount: string, currency: string) {
  // The currency code stays visible: USD and MXN share the "$" symbol
  return `${formatMoney({ amount: amount as never, currency })} ${currency}`
}

function withAmount(body: string, pattern: RegExp): Keys {
  const match = body.match(pattern)
  return match ? { bodyKey: 'body', values: { amount: money(match[1]!, match[2]!) } } : { bodyKey: 'bodyGeneric' }
}

function withCurrency(body: string): Keys {
  const currency = body.match(/^Your ([A-Z]{3}) wallet/)?.[1]
  return currency ? { bodyKey: 'body', values: { currency } } : { bodyKey: 'bodyGeneric' }
}

// The body is what the administrator wrote, in whatever language they wrote it
function withResolution(body: string): Keys {
  return body.trim() ? { bodyKey: 'body', values: { resolution: body.trim() } } : { bodyKey: 'bodyGeneric' }
}

const readers: Record<string, (body: string, t: TFunction, language: string) => Keys> = {
  ACCOUNT_LOCKED: (body, _t, language) => {
    const [, day, time] = body.match(/until (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC/) ?? []
    return day
      ? { bodyKey: 'body', values: { until: formatDateTime(`${day}T${time}:00Z`, intlLocale(language)) } }
      : { bodyKey: 'bodyGeneric' }
  },
  PASSWORD_CHANGED: (body) => (body.includes('was reset') ? { titleKey: 'titleReset', bodyKey: 'bodyReset' } : { bodyKey: 'body' }),
  TWO_FACTOR_DISABLED: (body) => ({ bodyKey: body.startsWith('Our support team') ? 'bodySupport' : 'body' }),
  DEPOSIT_RECEIVED: (body) => withAmount(body, new RegExp(`^${AMOUNT} was added`)),
  DEPOSIT_REJECTED: (body) => withAmount(body, new RegExp(`payment of ${AMOUNT} went`)),
  WITHDRAWAL_SENT: (body) => withAmount(body, new RegExp(`^${AMOUNT} was sent`)),
  WITHDRAWAL_FAILED: (body) => withAmount(body, new RegExp(`withdrawal of ${AMOUNT},`)),
  BANK_ACCOUNT_ADDED: (body) => {
    const lastFour = body.match(/ending in (\d+) was added/)?.[1]
    return lastFour ? { bodyKey: 'body', values: { lastFour } } : { bodyKey: 'bodyGeneric' }
  },
  BANK_ACCOUNT_REMOVED: (body) => {
    const lastFour = body.match(/ending in (\d+) was removed/)?.[1]
    return lastFour ? { bodyKey: 'body', values: { lastFour } } : { bodyKey: 'bodyGeneric' }
  },
  SESSIONS_REVOKED: (body) => {
    const count = body.match(/^(\d+) of your sessions/)?.[1]
    if (!count) return { bodyKey: 'bodyGeneric' }
    return count === '1' ? { bodyKey: 'bodyOne' } : { bodyKey: 'body', values: { count } }
  },
  TRANSFER_SENT: (body) => {
    const match = body.match(new RegExp(`^You sent ${AMOUNT} to (.+)\\.$`))
    return match ? { bodyKey: 'body', values: { amount: money(match[1]!, match[2]!), recipient: match[3]! } } : { bodyKey: 'bodyGeneric' }
  },
  TRANSFER_RECEIVED: (body, t) => {
    const match = body.match(new RegExp(`^(.+) sent you ${AMOUNT}\\.$`))
    if (!match) return { bodyKey: 'bodyGeneric' }
    const sender = match[1] === UNKNOWN_SENDER ? t('notifications.someone') : match[1]!
    return { bodyKey: 'body', values: { sender, amount: money(match[2]!, match[3]!) } }
  },
  WALLET_FROZEN: withCurrency,
  WALLET_UNFROZEN: withCurrency,
  // The reason is what the administrator wrote for the customer, in whatever language they wrote it
  WALLET_ADJUSTED: (body) => {
    const match = body.match(new RegExp(`^We (added|took) ${AMOUNT} (?:to|from) your wallet: (.+)$`, 's'))
    if (!match) return { bodyKey: 'bodyGeneric' }
    return { bodyKey: match[1] === 'added' ? 'bodyCredit' : 'bodyDebit', values: { amount: money(match[2]!, match[3]!), reason: match[4]! } }
  },
  // The reason is what the administrator wrote for the customer, in whatever language they wrote it
  IDENTITY_REJECTED: (body) => {
    const reason = body.match(/^We reviewed your INE and could not verify it: (.+)$/s)?.[1]
    return reason ? { bodyKey: 'body', values: { reason } } : { bodyKey: 'bodyGeneric' }
  },
  // The body is what the administrator wrote for the customer, in whatever language they wrote it
  SUPPORT_TICKET_RESOLVED: withResolution,
  SUPPORT_ESCALATION_RESOLVED: withResolution,
}

type Translated = keyof typeof es.notifications.types

/** Title and body of a notification in the given language. */
export function notificationText(
  notification: { type?: string; title?: string; body?: string },
  language: string,
): { title: string; body: string } {
  const t = i18n.getFixedT(language)
  const raw = String(notification.type)
  const body = notification.body ?? ''
  if (!i18n.exists(`notifications.types.${raw}.title`, { lng: language })) {
    // A type added to the API after this release: English is what it sends, so only Spanish needs the generic notice
    return language.startsWith('en') && notification.title
      ? { title: notification.title, body }
      : { title: t('notifications.types.UNKNOWN.title'), body: t('notifications.types.UNKNOWN.body') }
  }
  const type = raw as Translated
  const { titleKey = 'title', bodyKey, values } = readers[raw]?.(body, t, language) ?? { bodyKey: 'body' as const }
  // The keys come from the table above, which this signature can't check per type
  const key = (field: string) => `notifications.types.${type}.${field}` as 'notifications.types.UNKNOWN.title'
  return { title: t(key(titleKey)), body: t(key(bodyKey), values) }
}

/** Just the title, for the toast of a notification arriving live; that event carries no body. */
export function notificationTitle(type: string | undefined, title: string | undefined, language: string): string {
  return notificationText({ type, title, body: '' }, language).title
}
