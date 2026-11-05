import { lazy, Suspense } from 'react'

import { Skeleton } from '@/components/Skeleton'

import type { BalanceHistory } from './balance-series'

// Recharts is the largest library in the app: it loads after the balance and movements are on screen
const BalanceChart = lazy(() => import('./BalanceChart').then((m) => ({ default: m.BalanceChart })))

export function LazyBalanceChart(props: { history: BalanceHistory | undefined; currency: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-56" />}>
      <BalanceChart {...props} />
    </Suspense>
  )
}
