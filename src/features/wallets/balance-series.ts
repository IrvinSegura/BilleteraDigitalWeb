import type { Schemas } from '@/api/client'
import { amountOf } from '@/lib/format'

export type BalanceHistory = Schemas['BalanceHistoryResponse']

export interface BalancePoint {
  /** Calendar date, `yyyy-MM-dd` */
  date: string
  /** For the chart's scale; labels use {@link money}, exact to the cent */
  balance: number
  money: Schemas['MoneyResponse'] | undefined
}

function dayBefore(date: string): string {
  const time = new Date(`${date}T00:00:00Z`).getTime() - 86_400_000
  return new Date(time).toISOString().slice(0, 10)
}

/**
 * The balance the period opened with, as the close of the day before its first point, then each day's close, so a
 * wallet opened today still has a line from where it started.
 */
export function toSeries(history: BalanceHistory | undefined): BalancePoint[] {
  const points = (history?.points ?? []).filter((p) => p.date)
  if (points.length === 0) {
    return []
  }
  return [
    { date: dayBefore(points[0]!.date!), balance: amountOf(history?.openingBalance), money: history?.openingBalance },
    ...points.map((p) => ({ date: p.date!, balance: amountOf(p.balance), money: p.balance })),
  ]
}

/** Nothing to draw yet: the wallet has had no money during the whole period. */
export function isFlatAtZero(series: BalancePoint[]): boolean {
  return series.every((p) => p.balance === 0)
}
