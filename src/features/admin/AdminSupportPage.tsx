import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bot, GraduationCap, Headset, Lightbulb, NotebookPen, Search, Star, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CaseUrgency } from '@/features/support/CaseBadges'
import { ChatThread } from '@/features/support/ChatThread'
import { formatCount, formatDuration, formatRelative, shortId } from '@/lib/format'
import { agentState, botMiss, caseResolution, suggestionStatus, supportStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError, AdminStats, useListParams } from './shared'

const PAGE_SIZE = 20
const STATUSES = ['QUEUED', 'ASSIGNED', 'RESOLVED'] as const
const FILTERS = { status: STATUSES } as const
const KINDS = ['NOT_HELPED', 'NOT_FOUND', 'SUGGESTED', 'ASKED_AGAIN'] as const
const LANGUAGES = ['es', 'en'] as const
const PERIODS = ['7', '30', '90'] as const
const DEFAULT_PERIOD = '30'
const RESOLUTIONS = ['SOLVED', 'INFORMATION', 'TICKET', 'NO_REPLY', 'DUPLICATE', 'CUSTOMER_CLOSED', 'OTHER'] as const
const SUGGESTION_STATUSES = ['OPEN', 'ADDED', 'DISMISSED'] as const
// `view` is listed so moving through the report keeps it in the address
const BOT_FILTERS = { view: ['bot'], kind: KINDS, language: LANGUAGES, days: PERIODS } as const
const TEAM_FILTERS = { view: ['team'], days: PERIODS } as const
const SEARCH_DELAY_MS = 300

type View = 'cases' | 'team' | 'bot'

function CaseDetail({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const detail = useQuery({
    queryKey: ['admin', 'support', conversationId],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/conversations/{conversationId}', { params: { path: { conversationId } } })),
  })
  if (detail.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (detail.isError) return <AdminError error={detail.error} onRetry={() => detail.refetch()} />
  const { conversation, surveyScore, surveyComment, notes = [] } = detail.data

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {conversation?.userName} <StatusBadge value={conversation?.status} map={supportStatus} />
              <CaseUrgency priority={conversation?.priority} />
              <StatusBadge value={conversation?.resolution} map={caseResolution} />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{shortId(conversation?.id)}</span> ·{' '}
              <span>{conversation?.agentName ? t('admin.support.attendedBy', { name: conversation.agentName }) : t('admin.support.nobody')}</span>
            </p>
          </CardHeader>
          <CardContent className="text-sm">
            {surveyScore == null ? <p className="text-muted-foreground">{t('admin.support.notRated')}</p> : (
              <p className="flex flex-wrap items-center gap-1.5">
                <Star className="size-4 fill-warning text-warning" />
                <span className="font-medium">{t('admin.support.rating', { score: surveyScore })}</span>
                {surveyComment && <span className="text-muted-foreground">“{surveyComment}”</span>}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="gap-0 overflow-hidden py-0"><ChatThread conversation={conversation} reader="staff" /></Card>
      </div>
      <Card className="gap-4 lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><NotebookPen className="size-4" /> {t('admin.support.notesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.support.noNotes')}</p> : (
            <ol className="grid gap-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg border-l-4 border-warning/60 bg-warning/5 px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap break-words">{note.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{note.authorName} · {formatRelative(note.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [value])
  return debounced
}

function CaseList() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  const { status } = filters
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())
  const summary = useQuery({
    queryKey: ['admin', 'support', 'summary'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/summary')),
  })
  const cases = useQuery({
    queryKey: ['admin', 'support', 'list', status, q, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/conversations', {
      params: { query: { status: (status || undefined) as never, q: q || undefined, page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = cases.data?.items ?? []
  const average = summary.data?.averageScore
  const oldest = summary.data?.oldestQueuedAt
  const resolutions = (summary.data?.resolutions ?? {}) as Record<string, number>

  return (
    <>
      <AdminStats label={t('admin.support.statsLabel')} loading={summary.isPending} tiles={[
        { label: t('admin.support.withBot'), value: summary.data?.withBot },
        { label: t('labels.supportStatus.QUEUED'), value: summary.data?.queued, tone: 'warning' },
        { label: t('admin.support.urgentQueued'), value: summary.data?.queuedHighPriority, tone: 'danger' },
        { label: t('admin.support.longestWait'), value: oldest ? Math.round((summary.dataUpdatedAt - Date.parse(oldest)) / 60_000) : 0, tone: 'warning' },
        { label: t('labels.supportStatus.ASSIGNED'), value: summary.data?.assigned },
        { label: t('labels.supportStatus.RESOLVED'), value: summary.data?.resolved },
        { label: t('admin.support.average'), value: average == null ? undefined : Math.round(average * 10) / 10 },
        { label: t('admin.support.surveys'), value: summary.data?.surveys },
      ]} />
      {summary.data && (
        <section aria-label={t('admin.support.resolutionsLabel')} className="grid gap-2">
          <h2 className="text-sm font-medium">{t('admin.support.resolutionsLabel')}</h2>
          <ul className="flex flex-wrap gap-2">
            {RESOLUTIONS.map((value) => (
              <li key={value} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm">
                <StatusBadge value={value} map={caseResolution} />
                <span className="font-semibold tabular">{formatCount(resolutions[value] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={text} onChange={(e) => { setText(e.target.value); setPage(0) }} maxLength={100}
            placeholder={t('admin.support.search')} aria-label={t('admin.support.searchLabel')} className="pl-8" />
        </div>
        <SegmentedControl label={t('admin.support.statusFilter')} value={status} onChange={(next) => setFilter('status', next)} options={[
          { value: '', label: t('admin.support.all') },
          ...STATUSES.map((value) => ({ value, label: t(`labels.supportStatus.${value}`) })),
        ]} />
      </div>
      {cases.isError ? <AdminError error={cases.error} onRetry={() => cases.refetch()} /> : (
        <Card className="gap-0 py-0">
          {cases.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={Headset} title={t('admin.support.emptyTitle')} description={t('admin.support.emptyHint')} />
          ) : (
            <div className={cn(cases.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('admin.support.customer')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.support.agent')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('admin.support.resolution')}</TableHead>
                    <TableHead className="hidden pr-5 sm:table-cell">{t('admin.support.lastMessage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-48 pl-5 sm:max-w-64">
                        <span className="flex items-center gap-2">
                          <Link to={`/admin/support/${item.id}`} className="truncate font-medium text-primary hover:underline">{item.userName}</Link>
                          <CaseUrgency priority={item.priority} />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          <span className="font-mono">{shortId(item.id)}</span> · {item.lastText}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge value={item.status} map={supportStatus} /></TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{item.agentName ?? '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{item.resolution ? <StatusBadge value={item.resolution} map={caseResolution} /> : '—'}</TableCell>
                      <TableCell className="hidden pr-5 text-muted-foreground sm:table-cell">{formatRelative(item.lastMessageAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={page} hasNext={!!cases.data?.hasNext} onPageChange={setPage} disabled={cases.isFetching} />
        </Card>
      )}
    </>
  )
}

function stateOf(agent: Schemas['AgentReportResponse']) {
  return agent.busy ? 'BUSY' : agent.available ? 'FREE' : 'PAUSED'
}

/** How each agent is doing: whether they attend a case or paused now, and their numbers for a period. */
function TeamReport() {
  const { t } = useTranslation()
  const { filters, setFilter } = useListParams(TEAM_FILTERS)
  const period = filters.days || DEFAULT_PERIOD
  const days = Number(period)
  const agents = useQuery({
    queryKey: ['admin', 'support', 'agents', days],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/agents', { params: { query: { days } } })),
    refetchInterval: 15_000,
  })
  const team = agents.data ?? []
  const count = (state: string) => team.filter((agent) => stateOf(agent) === state).length

  return (
    <>
      <AdminStats label={t('admin.support.teamStatsLabel')} loading={agents.isPending} tiles={[
        { label: t('labels.agentState.FREE'), value: agents.data && count('FREE') },
        { label: t('labels.agentState.BUSY'), value: agents.data && count('BUSY'), tone: 'info' },
        { label: t('labels.agentState.PAUSED'), value: agents.data && count('PAUSED') },
      ]} />
      <SegmentedControl label={t('admin.support.period')} value={period}
        onChange={(next) => setFilter('days', next === DEFAULT_PERIOD ? '' : next)}
        options={PERIODS.map((value) => ({ value, label: t('admin.support.days', { count: Number(value) }) }))} />
      {agents.isError ? <AdminError error={agents.error} onRetry={() => agents.refetch()} /> : (
        <Card className="gap-0 py-0">
          {agents.isPending ? <ListSkeleton rows={4} /> : team.length === 0 ? (
            <EmptyState icon={Users} title={t('admin.support.agentsEmptyTitle')} description={t('admin.support.agentsEmptyHint')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{t('admin.support.agent')}</TableHead>
                  <TableHead>{t('admin.support.state')}</TableHead>
                  <TableHead className="text-right">{t('admin.support.attended')}</TableHead>
                  <TableHead className="text-right">{t('admin.support.closedCount')}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t('admin.support.firstResponse')}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t('admin.support.handle')}</TableHead>
                  <TableHead className="pr-5 text-right">{t('admin.support.ratingColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((agent) => {
                  const metrics = agent.metrics
                  return (
                    <TableRow key={agent.id}>
                      <TableCell className="pl-5 font-medium">{agent.name}</TableCell>
                      <TableCell><StatusBadge value={stateOf(agent)} map={agentState} /></TableCell>
                      <TableCell className="text-right tabular">{formatCount(metrics?.attended)}</TableCell>
                      <TableCell className="text-right tabular">{formatCount(metrics?.resolved)}</TableCell>
                      <TableCell className="hidden text-right tabular md:table-cell">{formatDuration(metrics?.firstResponseSeconds)}</TableCell>
                      <TableCell className="hidden text-right tabular md:table-cell">{formatDuration(metrics?.handleSeconds)}</TableCell>
                      <TableCell className="pr-5 text-right tabular">
                        {metrics?.averageScore == null ? '—' : `${Math.round(metrics.averageScore * 10) / 10} (${formatCount(metrics.surveys)})`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </>
  )
}

/** What agents think the assistant should answer by itself, for whoever keeps its knowledge files. */
function BotSuggestions() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<(typeof SUGGESTION_STATUSES)[number]>('OPEN')
  const [page, setPage] = useState(0)
  const suggestions = useQuery({
    queryKey: ['admin', 'support', 'bot', 'suggestions', status, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/bot/suggestions', { params: { query: { status, page, size: PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
  })
  const review = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: 'ADDED' | 'DISMISSED' }) =>
      unwrap(api.POST('/api/v1/admin/support/bot/suggestions/{suggestionId}/review', { params: { path: { suggestionId: id } }, body: { status: outcome } })),
    onSuccess: async () => {
      toast.success(t('admin.support.reviewed'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'support', 'bot', 'suggestions'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const items = suggestions.data?.items ?? []

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Lightbulb className="size-4" /> {t('admin.support.suggestions')}
          {!!suggestions.data?.open && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold">{formatCount(suggestions.data.open)}</span>}
        </CardTitle>
        <CardDescription>{t('admin.support.suggestionsHint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SegmentedControl size="sm" label={t('admin.support.suggestionFilter')} value={status}
          onChange={(next) => { setStatus(next); setPage(0) }}
          options={SUGGESTION_STATUSES.map((value) => ({ value, label: t(`labels.suggestionStatus.${value}`) }))} />
        {suggestions.isError ? <AdminError error={suggestions.error} onRetry={() => suggestions.refetch()} />
          : suggestions.isPending ? <ListSkeleton rows={2} /> : items.length === 0 ? (
            <EmptyState icon={GraduationCap} title={t('admin.support.suggestionsEmptyTitle')} description={t('admin.support.suggestionsEmptyHint')} />
          ) : (
            <ul className={cn('grid gap-3', suggestions.isPlaceholderData && 'opacity-60 transition-opacity')}>
              {items.map((item) => (
                <li key={item.id} className="grid gap-2 rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium break-words">{item.question}</p>
                    <StatusBadge value={item.status} map={suggestionStatus} />
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{t('admin.support.proposedAnswer')}</p>
                    <p className="whitespace-pre-wrap break-words">{item.answer}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t('admin.support.suggestedBy', { name: item.agentName, language: item.language?.toUpperCase() })}</span>
                    <span>· {formatRelative(item.createdAt)}</span>
                    {item.reviewedByName && <span>· {t('admin.support.reviewedBy', { name: item.reviewedByName })}</span>}
                    {item.conversationId && (
                      <Link to={`/admin/support/${item.conversationId}`} className="text-primary hover:underline">{t('admin.support.seeConversation')}</Link>
                    )}
                    {item.status === 'OPEN' && (
                      <span className="ml-auto flex gap-2">
                        <Button size="sm" variant="ghost" disabled={review.isPending} onClick={() => review.mutate({ id: item.id!, outcome: 'DISMISSED' })}>
                          {t('admin.support.dismiss')}
                        </Button>
                        <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: item.id!, outcome: 'ADDED' })}>
                          {t('admin.support.markAdded')}
                        </Button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        {(page > 0 || suggestions.data?.hasNext) && (
          <Pager page={page} hasNext={!!suggestions.data?.hasNext} onPageChange={setPage} disabled={suggestions.isFetching} />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Where the assistant fails: what it did with the questions of a period, and the ones it couldn't solve grouped by how
 * they were written, the most repeated first. Their wording is what to add as keywords to its knowledge files.
 */
function BotReport() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(BOT_FILTERS)
  const { kind, language } = filters
  const period = filters.days || DEFAULT_PERIOD
  const days = Number(period)
  const summary = useQuery({
    queryKey: ['admin', 'support', 'bot', 'summary', days],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/bot/summary', { params: { query: { days } } })),
  })
  const misses = useQuery({
    queryKey: ['admin', 'support', 'bot', 'misses', kind, language, days, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/bot/misses', {
      params: { query: { kind: (kind || undefined) as (typeof KINDS)[number] | undefined, language: language || undefined, days, page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = misses.data?.items ?? []

  return (
    <>
      <AdminStats label={t('admin.support.botStatsLabel')} loading={summary.isPending} tiles={[
        { label: t('admin.support.questions'), value: summary.data?.questions },
        { label: t('admin.support.answered'), value: summary.data?.answered },
        { label: t('admin.support.helped'), value: summary.data?.helped },
        { label: t('admin.support.notHelped'), value: summary.data?.notHelped, tone: 'danger' },
        { label: t('admin.support.notFound'), value: summary.data?.notFound, tone: 'warning' },
        { label: t('admin.support.suggested'), value: summary.data?.suggested, tone: 'info' },
        { label: t('admin.support.askedAgain'), value: summary.data?.askedAgain },
        { label: t('admin.support.passedOn'), value: summary.data?.passedOn },
      ]} />
      <BotSuggestions />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl label={t('admin.support.period')} value={period}
          onChange={(next) => setFilter('days', next === DEFAULT_PERIOD ? '' : next)}
          options={PERIODS.map((value) => ({ value, label: t('admin.support.days', { count: Number(value) }) }))} />
        <SegmentedControl label={t('admin.support.kindFilter')} value={kind} onChange={(next) => setFilter('kind', next)} options={[
          { value: '', label: t('admin.support.all') },
          ...KINDS.map((value) => ({ value, label: t(`labels.botMiss.${value}`) })),
        ]} />
        <SegmentedControl label={t('admin.support.languageFilter')} value={language} onChange={(next) => setFilter('language', next)} options={[
          { value: '', label: t('admin.support.bothLanguages') },
          { value: 'es', label: t('admin.support.spanish') },
          { value: 'en', label: t('admin.support.english') },
        ]} />
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.support.botHint')}</p>
      {misses.isError ? <AdminError error={misses.error} onRetry={() => misses.refetch()} /> : (
        <Card className="gap-0 py-0">
          {misses.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={Bot} title={t('admin.support.botEmptyTitle')} description={t('admin.support.botEmptyHint')} />
          ) : (
            <div className={cn(misses.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('admin.support.question')}</TableHead>
                    <TableHead>{t('admin.support.kind')}</TableHead>
                    <TableHead className="text-right">{t('admin.support.times')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.support.languageFilter')}</TableHead>
                    <TableHead className="hidden pr-5 sm:table-cell">{t('admin.support.lastAsked')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const topics = item.topics ?? []
                    return (
                      <TableRow key={`${item.kind}-${item.language}-${item.question}-${topics.join('|')}`}>
                        <TableCell className="max-w-56 pl-5 whitespace-normal sm:max-w-md">
                          <span className="block font-medium break-words">{item.question}</span>
                          {topics.length > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {t(item.kind === 'SUGGESTED' ? 'admin.support.offered' : 'admin.support.answeredWith', { topics: topics.join(' · ') })}
                            </span>
                          )}
                          <Link to={`/admin/support/${item.conversationId}`} className="text-xs text-primary hover:underline">
                            {t('admin.support.seeConversation')}
                          </Link>
                        </TableCell>
                        <TableCell><StatusBadge value={item.kind} map={botMiss} /></TableCell>
                        <TableCell className="text-right font-medium tabular">{formatCount(item.times)}</TableCell>
                        <TableCell className="hidden text-muted-foreground uppercase md:table-cell">{item.language}</TableCell>
                        <TableCell className="hidden pr-5 text-muted-foreground sm:table-cell">{formatRelative(item.lastAskedAt)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={page} hasNext={!!misses.data?.hasNext} onPageChange={setPage} disabled={misses.isFetching} />
        </Card>
      )}
    </>
  )
}

/**
 * How support is doing, and each case with its survey and the team's notes; how each agent is doing; or where the
 * assistant fails and what agents suggest it learn. Administrators read cases but don't take part.
 */
export function AdminSupportPage() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const view: View = requested === 'bot' || requested === 'team' ? requested : 'cases'
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.support.title')} description={t('admin.support.description')}
        actions={conversationId ? (
          <Button variant="outline" render={<Link to="/admin/support" />}><ArrowLeft /> {t('admin.support.back')}</Button>
        ) : undefined} />
      {conversationId ? <CaseDetail conversationId={conversationId} /> : (
        <>
          <SegmentedControl label={t('admin.support.view')} value={view}
            onChange={(next) => setParams(next === 'cases' ? {} : { view: next })} options={[
              { value: 'cases', label: t('admin.support.cases') },
              { value: 'team', label: t('admin.support.team') },
              { value: 'bot', label: t('admin.support.bot') },
            ]} />
          {view === 'bot' ? <BotReport /> : view === 'team' ? <TeamReport /> : <CaseList />}
        </>
      )}
    </div>
  )
}
