import type { Schemas } from '@/api/client'
import { amountOf } from '@/lib/format'

export const OPERATION_KINDS = ['deposit', 'transfer', 'withdrawal'] as const
export type OperationKind = (typeof OPERATION_KINDS)[number]

export type VolumePoint = { date: string; operations: number } & Record<OperationKind, number>
export interface SignupPoint { date: string; count: number }

/** How a figure compares with the period before: `new` when that one had nothing to compare with. */
export interface Change {
  trend: 'up' | 'down' | 'flat' | 'new'
  percent: number
}

// The zone the API counts days in (wallet.accounts.limit-zone), wherever the browser is
const USERS_ZONE = 'America/Mexico_City'
const DAY_MS = 24 * 60 * 60 * 1000

export function usersToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: USERS_ZONE }).format(now)
}

/** The last `days` calendar days, today included, the oldest first. */
export function lastDays(days: number, today = usersToday()): string[] {
  const last = Date.parse(`${today}T00:00:00Z`)
  return Array.from({ length: days }, (_, index) =>
    new Date(last - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10))
}

/** One point per day: the API leaves out the days with nothing, and a chart must not skip them. */
export function toVolumeSeries(rows: Schemas['OperationDailyResponse'][], dates: string[], currency: string): VolumePoint[] {
  const points = new Map<string, VolumePoint>(dates.map((date) => [date, { date, operations: 0, deposit: 0, transfer: 0, withdrawal: 0 }]))
  for (const row of rows) {
    const point = points.get(row.date ?? '')
    const kind = OPERATION_KINDS.find((known) => known === row.kind)
    if (!point || !kind || row.amount?.currency !== currency) continue
    point[kind] += amountOf(row.amount)
    point.operations += row.count ?? 0
  }
  return [...points.values()]
}

export function toSignupSeries(rows: Schemas['DailySignups'][], dates: string[]): SignupPoint[] {
  const counts = new Map(rows.map((row) => [row.date, row.count ?? 0]))
  return dates.map((date) => ({ date, count: counts.get(date) ?? 0 }))
}

/** How much of each kind moved in the whole period. */
export function totalsOf(series: VolumePoint[]): Record<OperationKind, number> {
  const totals: Record<OperationKind, number> = { deposit: 0, transfer: 0, withdrawal: 0 }
  for (const point of series) {
    for (const kind of OPERATION_KINDS) totals[kind] += point[kind]
  }
  return totals
}

/** The money of every kind that moved on that day. */
export function movedOn(point: VolumePoint): number {
  return OPERATION_KINDS.reduce((sum, kind) => sum + point[kind], 0)
}

/** Operations per day, of every kind and currency, one number for each of the dates. */
export function operationsPerDay(rows: Schemas['OperationDailyResponse'][], dates: string[]): number[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.date ?? '', (counts.get(row.date ?? '') ?? 0) + (row.count ?? 0))
  }
  return dates.map((date) => counts.get(date) ?? 0)
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function changeBetween(current: number, previous: number): Change {
  if (previous === 0) {
    return current === 0 ? { trend: 'flat', percent: 0 } : { trend: 'new', percent: 0 }
  }
  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent === 0) return { trend: 'flat', percent: 0 }
  return { trend: percent > 0 ? 'up' : 'down', percent: Math.abs(percent) }
}
