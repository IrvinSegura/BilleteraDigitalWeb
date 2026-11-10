import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleCheck, FileSearch, IdCard, MessagesSquare, ShieldAlert, Ticket, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, formatMoney, shortId } from '@/lib/format'
import { adjustmentStatus, labelOf, operationStatus, ticketStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdjustmentDialog, signedAmount } from './AdjustmentDialog'
import { AdminError, DetailGrid, IdCell, ReasonAction, useListParams } from './shared'

const PAGE_SIZE = 20
const STATUSES = ['OPEN', 'RESOLVED'] as const
const FILTERS = { status: STATUSES } as const
// The API's limit for the resolution the customer reads
const MAX_RESOLUTION = 500

const detailKey = (id: string) => ['admin', 'tickets', 'detail', id] as const

/** Where the operation is looked up: transfers are one type in Operations, whichever side the customer was on. */
function operationsLink(kind: string | undefined, id: string | undefined) {
  if (kind?.startsWith('adjustment')) return `/admin/adjustments/${id}`
  const type = kind?.startsWith('transfer') ? 'transfer' : kind
  return `/admin/operations?type=${type}&id=${id}`
}

const kindLabel = (kind: string | undefined) => labelOf('support.inbox.kinds', kind ?? '')
const categoryLabel = (category: string | undefined) => labelOf('support.inbox.categories', category ?? 'OTHER')

/** The adjustments recorded against a ticket, whatever became of them. */
function TicketAdjustments({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation()
  const adjustments = useQuery({
    queryKey: ['admin', 'adjustments', 'ticket', ticketId],
    queryFn: () => unwrap(api.GET('/api/v1/admin/adjustments', { params: { query: { ticketId, size: 50 } } })),
  })
  const items = adjustments.data?.items ?? []
  if (items.length === 0) return null
  return (
    <section aria-label={t('admin.tickets.adjustments')} className="grid gap-2">
      <h3 className="text-xs text-muted-foreground">{t('admin.tickets.adjustments')}</h3>
      <ul className="divide-y rounded-lg border">
        {items.map((adjustment) => (
          <li key={adjustment.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <Link to={`/admin/adjustments/${adjustment.id}`} className="font-medium text-primary tabular hover:underline">{signedAmount(adjustment)}</Link>
            <StatusBadge value={adjustment.status} map={adjustmentStatus} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TicketDetail({ id }: { id: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: detailKey(id),
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/tickets/{ticketId}', { params: { path: { ticketId: id } } })),
  })

  if (detail.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (detail.isError) return <AdminError error={detail.error} onRetry={() => detail.refetch()} />
  const ticket = detail.data
  const operation = ticket.operation
  const open = ticket.status === 'OPEN'
  const aboutOperation = !!ticket.operationId
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{ticket.customerName ?? ticket.customerEmail}</CardTitle>
            <Link to={`/admin/users/${ticket.userId}`} className="block truncate text-sm text-primary hover:underline">{ticket.customerEmail}</Link>
          </div>
          <StatusBadge value={ticket.status} map={ticketStatus} />
        </CardHeader>
        <CardContent className="grid gap-5">
          <DetailGrid rows={[
            aboutOperation
              ? { label: t('admin.tickets.operation'), value: <>{kindLabel(ticket.operationKind)} <IdCell id={ticket.operationId} to={operationsLink(ticket.operationKind, ticket.operationId)} /></> }
              : { label: t('admin.tickets.subject'), value: categoryLabel(ticket.category) },
            ...(!aboutOperation ? [] : operation ? [
              { label: t('admin.tickets.amount'), value: formatMoney(operation.amount) },
              { label: t('admin.tickets.operationStatus'), value: <StatusBadge value={operation.status} map={operationStatus} /> },
              { label: t('admin.tickets.operationDate'), value: formatDateTime(operation.createdAt) },
              ...(operation.reason ? [{ label: t('admin.tickets.operationReason'), value: operation.reason }] : []),
            ] : [{ label: t('admin.tickets.amount'), value: t('admin.tickets.operationGone') }]),
            { label: t('admin.tickets.openedBy'), value: ticket.openedByName ?? '—' },
            { label: t('admin.tickets.opened'), value: formatDateTime(ticket.createdAt) },
            ...(ticket.resolvedAt ? [
              { label: t('admin.tickets.resolvedBy'), value: ticket.resolvedByName ?? '—' },
              { label: t('admin.tickets.resolvedAt'), value: formatDateTime(ticket.resolvedAt) },
            ] : []),
          ]} />
          <div className="grid gap-1">
            <h3 className="text-xs text-muted-foreground">{t('admin.tickets.report')}</h3>
            <p className="whitespace-pre-line text-sm">{ticket.description}</p>
          </div>
          {ticket.resolution && (
            <div className="grid gap-1">
              <h3 className="text-xs text-muted-foreground">{t('admin.tickets.resolution')}</h3>
              <p className="whitespace-pre-line text-sm">{ticket.resolution}</p>
            </div>
          )}
          <TicketAdjustments ticketId={id} />
          <div className="flex flex-wrap gap-2">
            {aboutOperation ? (
              <Link to={operationsLink(ticket.operationKind, ticket.operationId)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <FileSearch /> {t('admin.tickets.openOperation')}
              </Link>
            ) : (
              <Link to={`/admin/users/${ticket.userId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <UserRound /> {t('admin.tickets.openAccount')}
              </Link>
            )}
            {ticket.category === 'IDENTITY' && (
              <Link to="/admin/identity" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <IdCard /> {t('admin.tickets.openIdentity')}
              </Link>
            )}
            <Link to={`/admin/support/${ticket.conversationId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <MessagesSquare /> {t('admin.tickets.openConversation')}
            </Link>
            {open && aboutOperation && ticket.userId && <AdjustmentDialog userId={ticket.userId} ticketId={id} />}
          </div>
        </CardContent>
      </Card>
      {open && (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="flex flex-1 gap-2 text-sm text-muted-foreground">
              <ShieldAlert className="size-4 shrink-0 text-warning-foreground dark:text-warning" /> {t(aboutOperation ? 'admin.tickets.checklist' : 'admin.tickets.checklistAccount')}
            </p>
            <ReasonAction
              primary
              trigger={<><CircleCheck /> {t('admin.tickets.resolve')}</>}
              title={t('admin.tickets.resolveTitle')}
              description={t('admin.tickets.resolveHint')}
              confirmLabel={t('admin.tickets.resolve')}
              fieldLabel={t('admin.tickets.resolution')}
              fieldHint={t('admin.tickets.resolutionHint')}
              maxLength={MAX_RESOLUTION}
              onConfirm={async (resolution) => {
                const resolved = await unwrap(api.POST('/api/v1/admin/support/tickets/{ticketId}/resolve', {
                  params: { path: { ticketId: id } }, body: { resolution },
                }))
                queryClient.setQueryData(detailKey(id), resolved)
                // The list and the menu's count; the detail was just set
                await queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'], predicate: (query) => query.queryKey[2] !== 'detail' })
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TicketList() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  // What waits for someone comes first
  const status = filters.status || 'OPEN'
  const list = useQuery({
    queryKey: ['admin', 'tickets', 'list', status, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/tickets', {
      params: { query: { status: status as typeof STATUSES[number], page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = list.data?.items ?? []
  const resolved = status === 'RESOLVED'
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label={t('admin.tickets.statusFilter')} value={status} onChange={(next) => setFilter('status', next)}
          options={STATUSES.map((value) => ({ value, label: t(`labels.ticketStatus.${value}`) }))} />
        {list.data && <p className="text-sm text-muted-foreground">{t('admin.tickets.openCount', { count: list.data.open ?? 0 })}</p>}
      </div>
      {list.isError ? <AdminError error={list.error} onRetry={() => list.refetch()} /> : (
        <Card className="gap-0 py-0">
          {list.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={Ticket} title={t('admin.tickets.emptyTitle')} description={t('admin.tickets.emptyHint')} />
          ) : (
            <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('admin.tickets.customer')}</TableHead>
                    <TableHead>{t('admin.tickets.subject')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.tickets.openedBy')}</TableHead>
                    <TableHead className="pr-5">{resolved ? t('admin.tickets.resolvedAt') : t('admin.tickets.opened')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="max-w-56 pl-5 sm:max-w-none">
                        <Link to={`/admin/tickets/${ticket.id}`} className="block truncate font-medium text-primary hover:underline">
                          {ticket.customerName ?? shortId(ticket.userId)}
                        </Link>
                        <span className="block max-w-80 truncate text-xs text-muted-foreground">{ticket.description}</span>
                      </TableCell>
                      <TableCell>
                        {ticket.operationId
                          ? <>{kindLabel(ticket.operationKind)} <span className="font-mono text-xs text-muted-foreground">{shortId(ticket.operationId)}</span></>
                          : categoryLabel(ticket.category)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{ticket.openedByName ?? '—'}</TableCell>
                      <TableCell className="pr-5 text-muted-foreground">{formatDateTime(resolved ? ticket.resolvedAt : ticket.createdAt)}</TableCell>
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
 * What support escalated: an operation, or a problem with the account itself. Support sees the case and never moves
 * money; the administrator fixes it with an adjustment or the account's tools, which keep the audit trail, and records
 * here what was done.
 */
export function AdminTicketsPage() {
  const { t } = useTranslation()
  const { ticketId } = useParams()
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.tickets.title')} description={t('admin.tickets.description')} />
      {ticketId ? (
        <>
          <Link to="/admin/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> {t('admin.tickets.backToList')}
          </Link>
          <TicketDetail key={ticketId} id={ticketId} />
        </>
      ) : <TicketList />}
    </div>
  )
}
