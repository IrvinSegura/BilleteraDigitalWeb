import type { Schemas } from '@/api/client'
import i18n from '@/i18n'
import { intlLocale } from '@/i18n/intl-locale'

// Money reads the same in either language; dates and relative times follow the active one
const MONEY_LOCALE = 'es-MX'

const moneyFormats = new Map<string, Intl.NumberFormat>()

function moneyFormat(currency: string) {
  let format = moneyFormats.get(currency)
  if (!format) {
    format = new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    moneyFormats.set(currency, format)
  }
  return format
}

/** Formats an API amount, a decimal string, without going through a float so no cent is lost. */
export function formatMoney(money: Schemas['MoneyResponse'] | undefined): string {
  const currency = money?.currency ?? 'MXN'
  return moneyFormat(currency).format((money?.amount ?? '0') as Intl.StringNumericLiteral)
}

/** Formats an amount in minor units (cents), as the admin ledger endpoints answer. */
export function formatMinor(minor: number | undefined, currency = 'MXN'): string {
  const digits = moneyFormat(currency).resolvedOptions().maximumFractionDigits ?? 2
  return moneyFormat(currency).format((minor ?? 0) / 10 ** digits)
}

export function amountOf(money: Schemas['MoneyResponse'] | undefined): number {
  return Number(money?.amount ?? 0)
}

function activeLocale(): string {
  return intlLocale(i18n.resolvedLanguage ?? 'es')
}

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
const DATE_ONLY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
const SHORT_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
// UTC: a calendar date has no time zone, and reading it as local midnight could show the day before
const CALENDAR_DAY: Intl.DateTimeFormatOptions = { ...SHORT_DAY, timeZone: 'UTC' }
const CALENDAR_DATE: Intl.DateTimeFormatOptions = { ...DATE_ONLY, timeZone: 'UTC' }
const CALENDAR_MONTH: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' }

// Creating a formatter is slow and a statement formats hundreds of dates, so each one is kept per locale
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(options: Intl.DateTimeFormatOptions, locale = activeLocale()) {
  const key = locale + JSON.stringify(options)
  let format = dateFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options)
    dateFormats.set(key, format)
  }
  return format
}

/** @param locale only for text in a language other than the active one */
export function formatDateTime(iso: string | undefined, locale?: string): string {
  return iso ? dateFormat(DATE_TIME, locale).format(new Date(iso)) : '—'
}

export function formatDate(iso: string | undefined): string {
  return iso ? dateFormat(DATE_ONLY).format(new Date(iso)) : '—'
}

export function formatShortDay(iso: string): string {
  return dateFormat(SHORT_DAY).format(new Date(iso))
}

/** Formats a calendar date as the API sends it (`2026-11-03`), the same day wherever the browser is. */
export function formatCalendarDay(date: string): string {
  return dateFormat(CALENDAR_DAY).format(new Date(`${date}T00:00:00Z`))
}

/** Like {@link formatCalendarDay}, with the year. */
export function formatCalendarDate(date: string): string {
  return dateFormat(CALENDAR_DATE).format(new Date(`${date}T00:00:00Z`))
}

/** A month as `2026-11` names it: "noviembre de 2026", "November 2026". */
export function formatMonth(month: string): string {
  return dateFormat(CALENDAR_MONTH).format(new Date(`${month}-01T00:00:00Z`))
}

/** "hace 5 minutos", "ayer"…; older than a week falls back to the date. */
export function formatRelative(iso: string | undefined): string {
  if (!iso) {
    return '—'
  }
  const relative = new Intl.RelativeTimeFormat(activeLocale(), { numeric: 'auto' })
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 45) return i18n.t('format.justNow')
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 604800) return relative.format(Math.round(seconds / 86400), 'day')
  return formatDate(iso)
}

/** A count, with the digit grouping of the active language. */
export function formatCount(count: number | undefined): string {
  return (count ?? 0).toLocaleString(activeLocale())
}

/** A figure on a chart's axis: "2 mil", "2K". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(activeLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** First 8 characters of a UUID, enough to tell operations apart on screen. */
export function shortId(id: string | undefined): string {
  return id ? id.slice(0, 8) : '—'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** A fresh Idempotency-Key: the API runs a money movement once per key, so retries never double it. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
