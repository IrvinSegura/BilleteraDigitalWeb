import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBalanceHistory } from '@/api/queries'
import { ErrorState } from '@/components/ErrorState'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { LazyBalanceChart as BalanceChart } from './LazyBalanceChart'

const PERIODS = [7, 30, 90]

/** The wallet's balance chart with its period picker. */
export function BalanceHistoryCard({ walletId, currency, title, className }: {
  walletId: string
  currency: string
  title: string
  className?: string
}) {
  const { t } = useTranslation()
  const [days, setDays] = useState(30)
  const history = useBalanceHistory(walletId, days)
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <SegmentedControl label={t('common.period')} size="sm" value={days} onChange={setDays}
            options={PERIODS.map((value) => ({ value, label: t('wallets.chart.periodDays', { days: value }) }))} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {history.isPending ? <Skeleton className="h-56" /> : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : (
          <div className={cn(history.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <BalanceChart history={history.data} currency={currency} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
