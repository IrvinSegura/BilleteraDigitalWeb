import { ArrowDownLeft, ArrowLeft, SearchX, Snowflake } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'

import { type MovementFilters, useMovements, useWallet } from '@/api/queries'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pager } from '@/components/Pager'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

import { BalanceCard } from './BalanceCard'
import { BalanceHistoryCard } from './BalanceHistoryCard'
import { countActive, filtersFrom, filtersToParams, MovementFilterBar } from './MovementFilterBar'
import { MovementList } from './MovementList'

const PAGE_SIZE = 20

export function WalletDetailPage() {
  const { t } = useTranslation()
  const { walletId = '' } = useParams()
  const wallet = useWallet(walletId)
  // In the address rather than in state, so coming back from a receipt finds the list as it was
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const filters = useMemo(() => filtersFrom(new URLSearchParams(query)), [query])
  const page = Math.max(0, Math.trunc(Number(params.get('page'))) || 0)
  const changeFilters = useCallback((next: MovementFilters) => {
    setParams(filtersToParams(next), { replace: true })
  }, [setParams])
  const setPage = (next: number) => {
    const withPage = filtersToParams(filters)
    if (next > 0) withPage.set('page', String(next))
    setParams(withPage, { replace: true })
  }
  const invalidPeriod = !!filters.from && !!filters.to && filters.from > filters.to
  const movements = useMovements(invalidPeriod ? undefined : walletId, page, PAGE_SIZE, filters)
  const items = movements.data?.items ?? []

  return (
    <div className="space-y-6">
      <Link to="/wallets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('common.wallets')}
      </Link>
      {wallet.isPending ? <Skeleton className="h-56 rounded-3xl" /> : wallet.isError ? (
        <Card><ErrorState error={wallet.error} onRetry={() => wallet.refetch()} /></Card>
      ) : (
        <>
          <BalanceCard wallet={wallet.data} />
          {wallet.data.status === 'FROZEN' && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/8 px-4 py-3 text-sm">
              <Snowflake className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <p>{t('wallets.frozenNotice')}</p>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <BalanceHistoryCard className="h-fit" walletId={walletId} currency={wallet.data.balance?.currency ?? 'MXN'}
              title={t('wallets.chart.label')} />
            <Card className="gap-0 pb-0">
              <CardHeader className="border-b pb-4"><CardTitle>{t('common.movements')}</CardTitle></CardHeader>
              <MovementFilterBar walletId={walletId} filters={filters} onChange={changeFilters} />
              {invalidPeriod ? null : movements.isPending ? <ListSkeleton rows={6} /> : movements.isError ? (
                <ErrorState error={movements.error} onRetry={() => movements.refetch()} />
              ) : items.length === 0 && countActive(filters) > 0 ? (
                <EmptyState icon={SearchX} title={t('wallets.detail.noResultsTitle')} description={t('wallets.detail.noResultsHint')} />
              ) : items.length === 0 ? (
                <EmptyState icon={ArrowDownLeft} title={t('wallets.detail.emptyTitle')} description={t('wallets.detail.emptyHint')} />
              ) : (
                <div className={movements.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
                  <MovementList movements={items} walletId={walletId} />
                </div>
              )}
              <Pager page={page} hasNext={!!movements.data?.hasNext} onPageChange={setPage} disabled={movements.isFetching} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
