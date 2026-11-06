import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { api, unwrap } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatMoney } from '@/lib/format'
import { walletStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError, AdminStats, IdCell, useListParams } from './shared'

const PAGE_SIZE = 20
const FILTERS = { status: ['ACTIVE', 'FROZEN'] } as const

/** Every wallet on the platform, the newest first; freezing one is done from its owner's account. */
export function AdminWalletsPage() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  const { status } = filters

  const stats = useQuery({
    queryKey: ['admin', 'wallets', 'stats'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/wallets/stats')),
  })
  const wallets = useQuery({
    queryKey: ['admin', 'wallets', 'list', status, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/wallets', {
      params: { query: { status: status || undefined, page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = wallets.data?.items ?? []
  const counts = stats.data
  const active = counts?.total !== undefined && counts.frozen !== undefined ? counts.total - counts.frozen : undefined

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.wallets.title')} description={t('admin.wallets.description')} />
      <AdminStats label={t('admin.wallets.statsLabel')} loading={stats.isPending} tiles={[
        { label: t('admin.wallets.total'), value: counts?.total },
        { label: t('admin.wallets.activeCount'), value: active },
        { label: t('admin.wallets.frozenCount'), value: counts?.frozen, tone: 'info' },
      ]} />
      <SegmentedControl label={t('admin.wallets.statusFilter')} value={status} onChange={(next) => setFilter('status', next)} options={[
        { value: '', label: t('admin.wallets.all') },
        { value: 'ACTIVE', label: t('labels.walletStatus.ACTIVE') },
        { value: 'FROZEN', label: t('labels.walletStatus.FROZEN') },
      ]} />
      {wallets.isError ? <AdminError error={wallets.error} onRetry={() => wallets.refetch()} /> : (
        <Card className="gap-0 py-0">
          {wallets.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={Wallet} title={t('admin.wallets.emptyTitle')} description={t('admin.wallets.emptyHint')} />
          ) : (
            <div className={cn(wallets.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('common.wallet')}</TableHead>
                    <TableHead>{t('admin.wallets.owner')}</TableHead>
                    <TableHead>{t('common.balance')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="hidden pr-5 md:table-cell">{t('admin.users.opened')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((w) => (
                    <TableRow key={w.id}>
                      {/* On a phone the id gives its room to the state, which is what this list is read for */}
                      <TableCell className="pl-5"><span className="font-medium">{w.balance?.currency}</span> <span className="hidden sm:inline"><IdCell id={w.id} /></span></TableCell>
                      <TableCell><IdCell id={w.ownerId} to={`/admin/users/${w.ownerId}`} /></TableCell>
                      <TableCell className="font-medium tabular">{formatMoney(w.balance)}</TableCell>
                      <TableCell><StatusBadge value={w.status} map={walletStatus} /></TableCell>
                      <TableCell className="hidden pr-5 text-muted-foreground md:table-cell">{formatDate(w.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={page} hasNext={!!wallets.data?.hasNext} onPageChange={setPage} disabled={wallets.isFetching} />
        </Card>
      )}
    </div>
  )
}
