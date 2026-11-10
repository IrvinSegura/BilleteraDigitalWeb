import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ClipboardCheck, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { api, type Schemas, unwrap } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Card } from '@/components/ui/card'
import { formatRelative, shortId } from '@/lib/format'
import { ticketStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { TicketSubject } from './CaseOperations'

const PAGE_SIZE = 20
// An administrator takes minutes, not seconds
const POLL_MS = 30_000
const FILTERS = { open: 'OPEN', resolved: 'RESOLVED', all: undefined } as const
type Filter = keyof typeof FILTERS

const MY_TICKETS_KEY = ['support', 'escalated'] as const

function EscalatedTicket({ ticket }: { ticket: Schemas['TicketResponse'] }) {
  const { t } = useTranslation()
  const resolved = ticket.status === 'RESOLVED'
  return (
    <li className="grid gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <p className="font-medium"><TicketSubject ticket={ticket} /></p>
          <p className="text-xs text-muted-foreground">
            {ticket.customerName && <>{t('support.escalated.customer', { name: ticket.customerName })} · </>}
            {t('support.escalated.escalatedAgo', { time: formatRelative(ticket.createdAt) })}
          </p>
        </div>
        <StatusBadge value={ticket.status} map={ticketStatus} />
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{ticket.description}</p>
      {resolved && (
        <div className="rounded-lg border-l-4 border-success/60 bg-success/5 px-3 py-2 text-sm">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">{t('support.escalated.resolution')}</p>
          <p className="whitespace-pre-wrap break-words">{ticket.resolution}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('support.escalated.resolvedBy', { name: ticket.resolvedByName ?? '—', time: formatRelative(ticket.resolvedAt) })}
          </p>
        </div>
      )}
      <Link to={`/support/inbox/${ticket.conversationId}`}
        className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-primary hover:underline">
        {t('support.escalated.seeCase', { folio: shortId(ticket.conversationId) })} <ArrowUpRight className="size-3.5" />
      </Link>
    </li>
  )
}

/**
 * What the agent passed to the administrators from any of their cases, so they can follow it until it is settled
 * even after the case closed: the waiting ones first, the oldest at the top.
 */
export function EscalatedPage() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('open')
  const [page, setPage] = useState(0)
  const tickets = useQuery({
    queryKey: [...MY_TICKETS_KEY, filter, page],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/tickets', { params: { query: { status: FILTERS[filter], page, size: PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  })
  const items = tickets.data?.items ?? []
  const open = tickets.data?.open

  return (
    <div className="space-y-5">
      <PageHeader title={t('support.escalated.title')}
        description={open == null ? t('support.escalated.description')
          : `${t('support.escalated.openCount', { count: open })} ${t('support.escalated.description')}`} />
      <SegmentedControl label={t('support.escalated.filterLabel')} value={filter}
        onChange={(next) => { setFilter(next); setPage(0) }}
        options={(Object.keys(FILTERS) as Filter[]).map((value) => ({ value, label: t(`support.escalated.filters.${value}`) }))} />
      <Card className="gap-0 overflow-hidden py-0">
        {tickets.isPending ? <ListSkeleton rows={4} /> : tickets.isError ? (
          <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
        ) : items.length === 0 ? (
          filter === 'open'
            ? <EmptyState icon={ClipboardCheck} title={t('support.escalated.emptyOpenTitle')} description={t('support.escalated.emptyOpenHint')} />
            : <EmptyState icon={ClipboardList} title={t('support.escalated.emptyTitle')} description={t('support.escalated.emptyHint')} />
        ) : (
          <ul className={cn('divide-y', tickets.isPlaceholderData && 'opacity-60 transition-opacity')}>
            {items.map((ticket) => <EscalatedTicket key={ticket.id} ticket={ticket} />)}
          </ul>
        )}
        {(page > 0 || tickets.data?.hasNext) && (
          <div className="border-t"><Pager page={page} hasNext={!!tickets.data?.hasNext} onPageChange={setPage} disabled={tickets.isFetching} /></div>
        )}
      </Card>
    </div>
  )
}
