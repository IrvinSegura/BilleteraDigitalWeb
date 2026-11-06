import { api, type Schemas, unwrap } from '@/api/client'

export type Money = Schemas['MoneyResponse']
export type StatementMovement = Schemas['MovementResponse']

const PAGE_SIZE = 100
// A month with more movements than this is cut, and the statement says so
const MAX_PAGES = 50

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, number! - 1 + by, 1))
  return date.toISOString().slice(0, 7)
}

export function lastDay(month: string): string {
  return new Date(Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

/** Every movement of the month, oldest first, reading the API's pages one after another. */
export async function fetchMonthMovements(walletId: string, month: string) {
  const items: StatementMovement[] = []
  let page = 0
  let hasNext = true
  while (hasNext && page < MAX_PAGES) {
    const result = await unwrap(api.GET('/api/v1/wallets/{walletId}/movements', {
      params: { path: { walletId }, query: { page, size: PAGE_SIZE, from: `${month}-01`, to: lastDay(month) } },
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

/** One wallet's month: its balances and every movement. */
export async function fetchWalletStatement(walletId: string, currency: string, month: string): Promise<WalletStatement> {
  const [summary, movements] = await Promise.all([
    unwrap(api.GET('/api/v1/wallets/{walletId}/summary', { params: { path: { walletId }, query: { month } } })),
    fetchMonthMovements(walletId, month),
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
