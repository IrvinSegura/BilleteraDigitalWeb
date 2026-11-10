import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, HandCoins, Info, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { useUser } from '@/auth/auth-context'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, formatMoney, shortId } from '@/lib/format'
import { adjustmentStatus, labelOf } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { adjustmentError, MAX_ADJUSTMENT_REASON, signedAmount } from './AdjustmentDialog'
import { AdminError, DetailGrid, IdCell, ReasonAction, useListParams } from './shared'

type Adjustment = Schemas['AdjustmentResponse']

const PAGE_SIZE = 20
const STATUSES = ['PENDING_APPROVAL', 'APPLIED', 'REJECTED'] as const
const FILTERS = { status: STATUSES } as const

const detailKey = (id: string) => ['admin', 'adjustments', 'detail', id] as const
const directionLabel = (direction: string | undefined) => labelOf('admin.adjustments.directions', direction ?? '')

function ApproveAction({ adjustment, onDone }: { adjustment: Adjustment; onDone: (next: Adjustment) => Promise<unknown> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const approve = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/adjustments/{adjustmentId}/approve', {
      params: { path: { adjustmentId: adjustment.id! } },
    })),
    onSuccess: async (next) => {
      toast.success(t('admin.adjustments.approved'))
      setOpen(false)
      await onDone(next)
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) approve.reset() }}>
      <DialogTrigger render={<Button size="sm" />}><Check /> {t('admin.adjustments.approve')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('admin.adjustments.approveTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.adjustments.approveHint', {
                direction: directionLabel(adjustment.direction),
                amount: `${formatMoney(adjustment.amount)} ${adjustment.amount?.currency ?? ''}`.trim(),
                customer: adjustment.customerName ?? shortId(adjustment.userId),
                interpolation: { escapeValue: false },
              })}
            </DialogDescription>
          </DialogHeader>
          <FormError message={approve.isError ? adjustmentError(approve.error, t('admin.adjustments.insufficient')) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
              {approve.isPending && <Loader2 className="animate-spin" />} {t('admin.adjustments.approve')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AdjustmentDetail({ id }: { id: string }) {
  const { t } = useTranslation()
  const user = useUser()
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: detailKey(id),
    queryFn: () => unwrap(api.GET('/api/v1/admin/adjustments/{adjustmentId}', { params: { path: { adjustmentId: id } } })),
  })
  // The wallet's balance, the lists and the menu's count all changed
  const settle = async (next: Adjustment) => {
    queryClient.setQueryData(detailKey(id), next)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'adjustments'], predicate: (query) => query.queryKey[2] !== 'detail' }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', next.userId, 'wallets'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'wallets'] }),
    ])
  }

  if (detail.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (detail.isError) return <AdminError error={detail.error} onRetry={() => detail.refetch()} />
  const adjustment = detail.data
  const pending = adjustment.status === 'PENDING_APPROVAL'
  const own = adjustment.requestedBy === user.id
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{adjustment.customerName ?? shortId(adjustment.userId)}</CardTitle>
            <Link to={`/admin/users/${adjustment.userId}`} className="block truncate text-sm text-primary hover:underline">{adjustment.customerEmail ?? shortId(adjustment.userId)}</Link>
          </div>
          <StatusBadge value={adjustment.status} map={adjustmentStatus} />
        </CardHeader>
        <CardContent className="grid gap-5">
          <DetailGrid rows={[
            { label: t('admin.adjustments.direction'), value: directionLabel(adjustment.direction) },
            { label: t('admin.adjustments.amount'), value: <span className="tabular">{signedAmount(adjustment)}</span> },
            { label: t('admin.adjustments.wallet'), value: <IdCell id={adjustment.walletId} /> },
            { label: t('admin.adjustments.requestedBy'), value: adjustment.requestedByName ?? '—' },
            { label: t('admin.adjustments.requestedAt'), value: formatDateTime(adjustment.requestedAt) },
            ...(adjustment.decidedAt ? [
              { label: t('admin.adjustments.decidedBy'), value: adjustment.decidedByName ?? '—' },
              { label: t('admin.adjustments.decidedAt'), value: formatDateTime(adjustment.decidedAt) },
            ] : []),
            ...(adjustment.ticketId ? [{ label: t('admin.adjustments.ticket'), value: <IdCell id={adjustment.ticketId} to={`/admin/tickets/${adjustment.ticketId}`} /> }] : []),
            ...(adjustment.journalEntryId ? [{ label: t('admin.adjustments.journalEntry'), value: <IdCell id={adjustment.journalEntryId} /> }] : []),
          ]} />
          <div className="grid gap-1">
            <h3 className="text-xs text-muted-foreground">{t('admin.adjustments.reason')}</h3>
            <p className="whitespace-pre-line text-sm">{adjustment.reason}</p>
          </div>
          {adjustment.rejectionReason && (
            <div className="grid gap-1">
              <h3 className="text-xs text-muted-foreground">{t('admin.adjustments.rejectionReason')}</h3>
              <p className="whitespace-pre-line text-sm">{adjustment.rejectionReason}</p>
            </div>
          )}
        </CardContent>
      </Card>
      {pending && (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="flex flex-1 gap-2 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" /> {t(own ? 'admin.adjustments.ownRequest' : 'admin.adjustments.secondApproval')}
            </p>
            <div className="flex flex-wrap gap-2">
              <ReasonAction
                trigger={<><X /> {t(own ? 'admin.adjustments.withdraw' : 'admin.adjustments.reject')}</>}
                title={t(own ? 'admin.adjustments.withdrawTitle' : 'admin.adjustments.rejectTitle')}
                description={t('admin.adjustments.rejectHint')}
                confirmLabel={t(own ? 'admin.adjustments.withdraw' : 'admin.adjustments.reject')}
                maxLength={MAX_ADJUSTMENT_REASON}
                onConfirm={async (reason) => {
                  await settle(await unwrap(api.POST('/api/v1/admin/adjustments/{adjustmentId}/reject', {
                    params: { path: { adjustmentId: id } }, body: { reason },
                  })))
                }}
              />
              {/* The API refuses it too: no one person moves a large sum */}
              {!own && <ApproveAction adjustment={adjustment} onDone={settle} />}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AdjustmentList() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  // What waits for someone comes first
  const status = filters.status || 'PENDING_APPROVAL'
  const list = useQuery({
    queryKey: ['admin', 'adjustments', 'list', status, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/adjustments', {
      params: { query: { status: status as typeof STATUSES[number], page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = list.data?.items ?? []
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label={t('admin.adjustments.statusFilter')} value={status} onChange={(next) => setFilter('status', next)}
          options={STATUSES.map((value) => ({ value, label: t(`labels.adjustmentStatus.${value}`) }))} />
        {list.data && <p className="text-sm text-muted-foreground">{t('admin.adjustments.pendingCount', { count: list.data.pending ?? 0 })}</p>}
      </div>
      {list.isError ? <AdminError error={list.error} onRetry={() => list.refetch()} /> : (
        <Card className="gap-0 py-0">
          {list.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={HandCoins} title={t('admin.adjustments.emptyTitle')} description={t('admin.adjustments.emptyHint')} />
          ) : (
            <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('admin.adjustments.customer')}</TableHead>
                    <TableHead>{t('admin.adjustments.amount')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.adjustments.requestedBy')}</TableHead>
                    <TableHead className="pr-5">{t('admin.adjustments.requestedAt')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell className="max-w-56 pl-5 sm:max-w-none">
                        <Link to={`/admin/adjustments/${adjustment.id}`} className="block truncate font-medium text-primary hover:underline">
                          {adjustment.customerName ?? shortId(adjustment.userId)}
                        </Link>
                        <span className="block max-w-80 truncate text-xs text-muted-foreground">{adjustment.reason}</span>
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap tabular">{signedAmount(adjustment)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{adjustment.requestedByName ?? '—'}</TableCell>
                      <TableCell className="pr-5 text-muted-foreground">{formatDateTime(adjustment.requestedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={page} hasNext={!!list.data?.hasNext} onPageChange={setPage} disabled={list.isFetching} />
        </Card>
      )}
    </>
  )
}

/**
 * Manual credits and debits to customers' wallets, and those waiting for a second administrator. They start from the
 * customer's account or from a ticket, where the wallet is known.
 */
export function AdminAdjustmentsPage() {
  const { t } = useTranslation()
  const { adjustmentId } = useParams()
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.adjustments.title')} description={t('admin.adjustments.description')} />
      {adjustmentId ? (
        <>
          <Link to="/admin/adjustments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> {t('admin.adjustments.backToList')}
          </Link>
          <AdjustmentDetail key={adjustmentId} id={adjustmentId} />
        </>
      ) : <AdjustmentList />}
    </div>
  )
}
