import { api, type Schemas, unwrap } from '@/api/client'
import { formatCalendarDate, formatMonth } from '@/lib/format'

export type Money = Schemas['MoneyResponse']
export type StatementMovement = Schemas['MovementResponse']

const PAGE_SIZE = 100
// A period with more movements than this is cut, and the statement says so
const MAX_PAGES = 50
// The API's limit for one statement
export const MAX_PERIOD_DAYS = 366

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** Calendar days `yyyy-MM-dd`, both included. */
export interface Period {
  from: string
  to: string
}

export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, number! - 1 + by, 1))
  return date.toISOString().slice(0, 7)
}

export function lastDay(month: string): string {
  return new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

export function monthPeriod(month: string): Period {
  return { from: `${month}-01`, to: lastDay(month) }
}

/** The month the period is, when it is exactly one calendar month. */
export function monthOf(period: Period): string | undefined {
  const month = period.from.slice(0, 7)
  return period.from === `${month}-01` && period.to === lastDay(month) ? month : undefined
}

export function daysIn(period: Period): number {
  return Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000) + 1
}

/** "Noviembre de 2026" for a month, "1 sep 2026 – 30 nov 2026" for anything else. */
export function periodTitle(period: Period): string {
  const month = monthOf(period)
  if (month) {
    const name = formatMonth(month)
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  return `${formatCalendarDate(period.from)} – ${formatCalendarDate(period.to)}`
}

/** A short name for files and folios: `2026-11` for a month, `2026-09-01_2026-11-30` otherwise. */
export function periodSlug(period: Period): string {
  return monthOf(period) ?? `${period.from}_${period.to}`
}

/**
 * The period a link asks for: `from` and `to`, or a `month`. Anything malformed, reversed, longer than a statement
 * can be, or outside the user's history (before `first`, after `today`) is ignored for `fallback`.
 */
export function periodFromParams(params: URLSearchParams, fallback: Period, first: string | undefined, today: string): Period {
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const month = params.get('month') ?? ''
  const asked = DAY.test(from) && DAY.test(to) ? { from, to } : MONTH.test(month) ? monthPeriod(month) : undefined
  if (!asked || asked.from > asked.to || asked.from > today || daysIn(asked) > MAX_PERIOD_DAYS) {
    return fallback
  }
  if (first && asked.to < first) {
    return fallback
  }
  // A month that started before the first record, or isn't over, still holds it whole; days picked by hand stay
  // within the user's history
  if (monthOf(asked)) {
    return asked
  }
  return {
    from: first && asked.from < first ? first : asked.from,
    to: asked.to > today ? today : asked.to,
  }
}

export function periodToParams(period: Period): Record<string, string> {
  const month = monthOf(period)
  return month ? { month } : { from: period.from, to: period.to }
}

/** The first calendar day with something of the user: the oldest wallet's, or the account's when there is none. */
export function firstRecordDay(wallets: { createdAt?: string }[], accountCreatedAt: string | undefined): string | undefined {
  const dates = wallets.map((wallet) => wallet.createdAt).filter((date): date is string => !!date)
  const oldest = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : accountCreatedAt
  return oldest ? localDay(oldest) : undefined
}

/** An instant as the calendar day it is in the browser's zone, `yyyy-MM-dd`. */
export function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

/** Every movement of the period, oldest first, reading the API's pages one after another. */
export async function fetchPeriodMovements(walletId: string, period: Period) {
  const items: StatementMovement[] = []
  let page = 0
  let hasNext = true
  while (hasNext && page < MAX_PAGES) {
    const result = await unwrap(api.GET('/api/v1/wallets/{walletId}/movements', {
      params: { path: { walletId }, query: { page, size: PAGE_SIZE, from: period.from, to: period.to } },
    }))
    items.push(...(result.items ?? []))
    hasNext = !!result.hasNext
    page++
  }
  return { items: items.reverse(), cut: hasNext }
}

export interface WalletStatement {
  walletId: string
  currency: string
  openingBalance?: Money
  moneyIn?: Money
  moneyOut?: Money
  closingBalance?: Money
  movements: StatementMovement[]
  /** More movements than the statement holds. */
  cut: boolean
}

/** One wallet's period: its balances and every movement. */
export async function fetchWalletStatement(walletId: string, currency: string, period: Period): Promise<WalletStatement> {
  const [summary, movements] = await Promise.all([
    unwrap(api.GET('/api/v1/wallets/{walletId}/summary', { params: { path: { walletId }, query: { ...period } } })),
    fetchPeriodMovements(walletId, period),
  ])
  return {
    walletId,
    currency,
    openingBalance: summary.openingBalance,
    moneyIn: summary.moneyIn,
    moneyOut: summary.moneyOut,
    closingBalance: summary.closingBalance,
    movements: movements.items,
    cut: movements.cut,
  }
}
