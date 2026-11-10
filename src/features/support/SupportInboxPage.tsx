import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Inbox, Search, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDuration, formatRelative, shortId } from '@/lib/format'
import { cn } from '@/lib/utils'

import { ResolveCase, TeachBot } from './CaseActions'
import { CaseOutcome, CaseUrgency } from './CaseBadges'
import { CaseDetails } from './CaseDetails'
import { CaseHandoff } from './CaseHandoff'
import { ChatComposer } from './ChatComposer'
import { ChatAvatar, ChatThread } from './ChatThread'
import { type InboxAlert, useAlertPrefs, useInboxAlerts } from './inbox-alerts'
import { AgentMetrics, AlertsButton, AvailabilityToggle, QueueStatus, SUMMARY_KEY } from './InboxToolbar'
import { SavedReplies } from './SavedReplies'
import { attachmentForm, pollsWhileOpen } from './support-api'

const PAGE_SIZE = 20
// A new case or queue arriving is less urgent than a message in the case at hand
const LIST_POLL_MS = 5_000
// Waits for the agent to stop typing before searching
const SEARCH_DELAY_MS = 300
const INBOX_KEY = ['support', 'inbox'] as const
// A case taken at once didn't really wait: "waited 0 s" is noise
const MIN_WAIT_SHOWN_SECONDS = 60
const FILTERS = { all: undefined, open: 'ASSIGNED', closed: 'RESOLVED' } as const
type Filter = keyof typeof FILTERS

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [value])
  return debounced
}

function CaseRow({ item }: { item: Schemas['ConversationSummaryResponse'] }) {
  const { t } = useTranslation()
  return (
    <Link to={`/support/inbox/${item.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted sm:gap-4 sm:px-5">
      <ChatAvatar name={item.userName} className="size-10 text-sm" />
      <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6">
        <span className="grid min-w-0 gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{item.userName}</span>
            <span className="shrink-0 text-xs text-muted-foreground sm:hidden">{formatRelative(item.lastMessageAt)}</span>
          </span>
          <span className="truncate text-sm text-muted-foreground">{item.lastText ?? t('support.inbox.noText')}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:justify-end sm:gap-3">
          <CaseUrgency priority={item.priority} />
          <CaseOutcome status={item.status} resolution={item.resolution} />
          <span className="ml-auto font-mono text-xs text-muted-foreground sm:ml-0 sm:w-20 sm:text-right">{shortId(item.id)}</span>
          <span className="hidden w-24 text-right text-xs text-muted-foreground sm:inline">{formatRelative(item.lastMessageAt)}</span>
        </span>
      </span>
      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  )
}

/** The agent's cases, one per row across the page; opening one takes them to it. */
function CaseList() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())
  const cases = useQuery({
    queryKey: [...INBOX_KEY, 'list', filter, q, page],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations', {
      params: { query: { status: FILTERS[filter], q: q || undefined, page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
    refetchInterval: LIST_POLL_MS,
  })
  const items = cases.data?.items ?? []
  const narrowed = filter !== 'all' || !!q

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={text} onChange={(e) => { setText(e.target.value); setPage(0) }}
            placeholder={t('support.inbox.search')} aria-label={t('support.inbox.searchLabel')} className="pl-8" maxLength={100} />
        </div>
        <SegmentedControl size="sm" label={t('support.inbox.filterLabel')} value={filter}
          onChange={(next) => { setFilter(next); setPage(0) }}
          options={(Object.keys(FILTERS) as Filter[]).map((value) => ({ value, label: t(`support.inbox.filters.${value}`) }))} />
      </div>
      <div className={cn(cases.isPlaceholderData && 'opacity-60 transition-opacity')}>
        {cases.isPending ? <ListSkeleton rows={5} /> : cases.isError ? (
          <ErrorState error={cases.error} onRetry={() => cases.refetch()} />
        ) : items.length === 0 ? (
          narrowed
            ? <EmptyState icon={SearchX} title={t('support.inbox.noMatchTitle')} description={t('support.inbox.noMatchHint')} />
            : <EmptyState icon={Inbox} title={t('support.inbox.emptyTitle')} description={t('support.inbox.emptyHint')} />
        ) : (
          <ul className="divide-y">
            {items.map((item) => <li key={item.id}><CaseRow item={item} /></li>)}
          </ul>
        )}
      </div>
      {(page > 0 || cases.data?.hasNext) && (
        <div className="border-t"><Pager page={page} hasNext={!!cases.data?.hasNext} onPageChange={setPage} disabled={cases.isFetching} /></div>
      )}
    </Card>
  )
}

/**
 * One case on a page of its own: who and how it goes across the top, then the customer's account, operations,
 * earlier cases and notes, and the chat below them.
 */
function CaseView({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const key = [...INBOX_KEY, 'case', conversationId]
  const conversation = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations/{conversationId}', { params: { path: { conversationId } } })),
    refetchInterval: (query) => pollsWhileOpen(query.state.data?.status),
  })
  const path = { params: { path: { conversationId } } }
  const update = (next: Schemas['ConversationResponse']) => {
    queryClient.setQueryData(key, next)
    void queryClient.invalidateQueries({ queryKey: [...INBOX_KEY, 'list'] })
    void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY })
  }
  const reply = useMutation({
    mutationFn: (text: string) => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/messages', { ...path, body: { text } })),
    onSuccess: update,
  })
  const attach = useMutation({
    mutationFn: ({ file, text }: { file: File; text: string }) =>
      unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/attachments', { ...path, ...attachmentForm(file, text) })),
    onSuccess: update,
  })

  if (conversation.isPending) return <div className="grid gap-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
  if (conversation.isError) return <Card><ErrorState error={conversation.error} onRetry={() => conversation.refetch()} /></Card>
  const data = conversation.data
  const active = data.status === 'ASSIGNED'
  const busy = reply.isPending || attach.isPending
  const failed = [reply, attach].find((action) => action.isError)
  const waited = data.escalatedAt && data.assignedAt ? (Date.parse(data.assignedAt) - Date.parse(data.escalatedAt)) / 1000 : undefined

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="py-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
          <ChatAvatar name={data.userName} className="size-12 text-base" />
          {/* A width of its own: the case's actions wrap below before they cut the customer's name */}
          <div className="grid min-w-0 flex-1 basis-56 gap-1.5">
            <h2 className="truncate text-lg font-semibold">{data.userName}</h2>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <CaseOutcome status={data.status} resolution={data.resolution} />
              <CaseUrgency priority={data.priority} />
              <span className="font-mono">{t('support.inbox.folio', { folio: shortId(data.id) })}</span>
              {waited != null && waited >= MIN_WAIT_SHOWN_SECONDS && <span>· {t('support.inbox.waited', { time: formatDuration(waited) })}</span>}
              {!active && data.resolvedAt && <span>· {t('support.inbox.closedAgo', { time: formatRelative(data.resolvedAt) })}</span>}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <TeachBot conversation={data} disabled={busy} />
            {active && (
              <>
                <CaseHandoff conversationId={conversationId} disabled={busy} />
                <ResolveCase conversationId={conversationId} disabled={busy} onResolved={update} />
              </>
            )}
          </div>
        </div>
      </Card>
      {/* Right under who the case is: what the agent checks before answering stays in sight */}
      <CaseDetails key={`${conversationId}-${active}`} conversationId={conversationId} active={active} />
      <Card className="min-w-0 gap-0 overflow-hidden py-0">
        <ChatThread conversation={data} reader="staff" className="max-h-[65svh] min-h-80 flex-1" />
        {active ? (
          <ChatComposer pending={busy} error={failed ? errorMessage(failed.error) : null} placeholder={t('support.inbox.placeholder')}
            onSend={(text) => reply.mutateAsync(text)} onAttach={(file, text) => attach.mutateAsync({ file, text })}
            tools={(draft, insert) => <SavedReplies draft={draft} onPick={insert} disabled={busy} />} />
        ) : (
          <p className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">{t('support.inbox.closed')}</p>
        )}
      </Card>
    </div>
  )
}

/**
 * A support agent's workplace. The inbox: whether they take new cases, how the queue is, how they are doing, and
 * their cases across the page. A case: who it is and how it goes, the customer's account, operations, earlier cases
 * and the team's notes, and everything said in it, the bot's part included. They are told of a new case or message
 * even in another tab.
 */
export function SupportInboxPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const [prefs, setPrefs] = useAlertPrefs()
  const summary = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/summary')),
    refetchInterval: LIST_POLL_MS,
    // Alerts are for when the agent is elsewhere
    refetchIntervalInBackground: true,
  })
  const active = summary.data?.activeConversationId
  const paused = summary.data?.available === false

  const unseen = useInboxAlerts({
    loaded: summary.isSuccess,
    activeCaseId: active,
    lastCustomerMessageAt: summary.data?.lastCustomerMessageAt,
    viewing: conversationId,
    prefs,
    onAlert: (alert: InboxAlert, hidden: boolean) => {
      const text = alert.kind === 'case'
        ? { title: t('support.inbox.alerts.newCase'), body: t('support.inbox.alerts.newCaseBody') }
        : { title: t('support.inbox.alerts.newMessage'), body: t('support.inbox.alerts.newMessageBody') }
      if (!hidden) {
        toast.info(text.title, {
          description: text.body,
          action: { label: t('support.inbox.openActive'), onClick: () => navigate(`/support/inbox/${alert.caseId}`) },
        })
      }
      return text
    },
  })

  const actions = (
    <>
      {active && active !== conversationId && (
        <Button render={<Link to={`/support/inbox/${active}`} />}>{t('support.inbox.openActive')}</Button>
      )}
      <AlertsButton prefs={prefs} onChange={setPrefs} unseen={unseen} />
      <AvailabilityToggle summary={summary.data} />
    </>
  )

  if (conversationId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="-ml-2" render={<Link to="/support/inbox" />}>
            <ArrowLeft /> {t('support.inbox.back')}
          </Button>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
        <CaseView key={conversationId} conversationId={conversationId} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('support.inbox.title')}
        description={!summary.data ? t('support.inbox.description')
          : paused ? t('support.inbox.availability.pausedHint') : t('support.inbox.queued', { count: summary.data.queued ?? 0 })}
        actions={actions} />
      <QueueStatus summary={summary.data} now={summary.dataUpdatedAt || Date.now()} />
      <AgentMetrics />
      <CaseList />
    </div>
  )
}
