import i18n from '@/i18n'
import { formatDateTime, formatMoney, shortId } from '@/lib/format'
import { labelOf } from '@/lib/labels'

/** Every action the backend records, each named under `admin.audit.actions`. */
export const auditActions = [
  'USER_REGISTERED',
  'USER_SIGNED_IN',
  'USER_LOCKED_OUT',
  'USER_EMAIL_VERIFIED',
  'USER_UNLOCKED',
  'USER_DISABLED',
  'USER_ENABLED',
  'USER_ROLE_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'PROFILE_UPDATED',
  'EMAIL_CHANGED',
  'ACCOUNT_CLOSED',
  'SESSIONS_REVOKED',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_DISABLED',
  'BANK_ACCOUNT_ADDED',
  'BANK_ACCOUNT_REMOVED',
  'CAPITAL_CONTRIBUTED',
  'WALLET_OPENED',
  'WALLET_FROZEN',
  'WALLET_UNFROZEN',
  'DEPOSIT_COMPLETED',
  'DEPOSIT_REJECTED',
  'WITHDRAWAL_REQUESTED',
  'WITHDRAWAL_COMPLETED',
  'WITHDRAWAL_FAILED',
  'TRANSFER_COMPLETED',
  'PROVIDER_TRANSACTION_RESOLVED',
] as const

const money = (amount: string, currency: string) => formatMoney({ amount, currency })

const AMOUNT = String.raw`(\d+(?:\.\d+)?) ([A-Z]{3})`
const ID = String.raw`([0-9a-f-]{36})`

// The audit log stores what the backend wrote, in English; these are the sentences it writes
const templates: [RegExp, (...parts: string[]) => string][] = [
  [/^role: (\S+), reason: (.+)$/s, (role, reason) => i18n.t('admin.audit.detail.roleChange', { role: labelOf('labels.roles', role), reason })],
  [/^role (\S+)$/, (role) => i18n.t('admin.audit.detail.role', { role: labelOf('labels.roles', role) })],
  [/^locked until (\S+)$/, (until) => i18n.t('admin.audit.detail.lockedUntil', { date: formatDateTime(until) })],
  [/^all sessions ended$/, () => i18n.t('admin.audit.detail.allSessionsEnded')],
  [/^(\d+) ended$/, (sessions) => i18n.t('admin.audit.detail.sessionsEnded', { sessions })],
  [/^reason: (.+)$/s, (reason) => i18n.t('admin.audit.detail.reason', { reason })],
  [new RegExp(`^bank account ${ID}: bank (\\S+), CLABE ending (\\d+)$`),
    (id, bank, clabe) => i18n.t('admin.audit.detail.bankAccountWithBank', { id: shortId(id), bank, clabe })],
  [new RegExp(`^bank account ${ID}: CLABE ending (\\d+)$`),
    (id, clabe) => i18n.t('admin.audit.detail.bankAccount', { id: shortId(id), clabe })],
  [new RegExp(`^${AMOUNT}, reference (.+), reason: (.+)$`, 's'),
    (amount, currency, reference, reason) => i18n.t('admin.audit.detail.capital', { amount: money(amount, currency), reference, reason })],
  [/^currency ([A-Z]{3})$/, (currency) => i18n.t('admin.audit.detail.currency', { currency })],
  [new RegExp(`^deposit ${ID}: ${AMOUNT} refunded, (.+)$`, 's'),
    (id, amount, currency, reason) => i18n.t('admin.audit.detail.depositRefunded', { id: shortId(id), amount: money(amount, currency), reason })],
  [new RegExp(`^deposit ${ID}: ${AMOUNT}$`),
    (id, amount, currency) => i18n.t('admin.audit.detail.deposit', { id: shortId(id), amount: money(amount, currency) })],
  [new RegExp(`^withdrawal ${ID}: ${AMOUNT} returned, (.+)$`, 's'),
    (id, amount, currency, reason) => i18n.t('admin.audit.detail.withdrawalReturned', { id: shortId(id), amount: money(amount, currency), reason })],
  [new RegExp(`^withdrawal ${ID}: ${AMOUNT}$`),
    (id, amount, currency) => i18n.t('admin.audit.detail.withdrawal', { id: shortId(id), amount: money(amount, currency) })],
  [new RegExp(`^transfer ${ID}: ${AMOUNT} to wallet ${ID}$`),
    (id, amount, currency, wallet) => i18n.t('admin.audit.detail.transfer', { id: shortId(id), amount: money(amount, currency), wallet: shortId(wallet) })],
]

/**
 * An audit event's details in the active language. Anything this does not recognize, such as a sentence from a newer
 * backend, is shown as it came: better untranslated than nothing in a log people rely on.
 */
export function auditDetails(action: string | undefined, details: string | undefined): string {
  if (!details) return '—'
  if (action === 'PROFILE_UPDATED') {
    const fields = details.split(', ').map((field) => labelOf('admin.audit.detail.profileFields', field)).join(', ')
    return i18n.t('admin.audit.detail.profileChanged', { fields })
  }
  if (action === 'PROVIDER_TRANSACTION_RESOLVED') {
    const parts = /^(\S+) (\S+), reason: (.+)$/s.exec(details)
    if (parts) return i18n.t('admin.audit.detail.providerResolved', { id: parts[2], reason: parts[3] })
  }
  for (const [pattern, write] of templates) {
    const parts = pattern.exec(details)
    if (parts) return write(...parts.slice(1))
  }
  return details
}

/** The first moment of a local day, for a `YYYY-MM-DD` value. */
export function startOfDay(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString()
}

/** The first moment after a local day: the API's upper bound is excluded, so the day itself counts whole. */
export function endOfDay(day: string): string {
  const next = new Date(`${day}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}
