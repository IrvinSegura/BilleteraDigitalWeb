import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Bot, Headset, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChatThread } from '@/features/support/ChatThread'
import { formatCount, formatRelative } from '@/lib/format'
import { botMiss, supportStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError, AdminStats, useListParams } from './shared'

const PAGE_SIZE = 20
const STATUSES = ['QUEUED', 'ASSIGNED', 'RESOLVED'] as const
const FILTERS = { status: STATUSES } as const
const KINDS = ['NOT_HELPED', 'NOT_FOUND', 'SUGGESTED', 'ASKED_AGAIN'] as const
const LANGUAGES = ['es', 'en'] as const
const PERIODS = ['7', '30', '90'] as const
const DEFAULT_PERIOD = '30'
// `view` is listed so moving through the report keeps it in the address
const BOT_FILTERS = { view: ['bot'], kind: KINDS, language: LANGUAGES, days: PERIODS } as const

function CaseDetail({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const detail = useQuery({
    queryKey: ['admin', 'support', conversationId],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/conversations/{conversationId}', { params: { path: { conversationId } } })),
  })
  if (detail.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (detail.isError) return <AdminError error={detail.error} onRetry={() => detail.refetch()} />
  const { conversation, surveyScore, surveyComment } = detail.data

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {conversation?.userName} <StatusBadge value={conversation?.status} map={supportStatus} />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {conversation?.agentName ? t('admin.support.attendedBy', { name: conversation.agentName }) : t('admin.support.nobody')}
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
  )
}

function CaseList() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  const { status } = filters
  const summary = useQuery({
    queryKey: ['admin', 'support', 'summary'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/summary')),
  })
  const cases = useQuery({
    queryKey: ['admin', 'support', 'list', status, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/conversations', {
      params: { query: { status: (status || undefined) as never, page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = cases.data?.items ?? []
  const average = summary.data?.averageScore

  return (
    <>
      <AdminStats label={t('admin.support.statsLabel')} loading={summary.isPending} tiles={[
        { label: t('admin.support.withBot'), value: summary.data?.withBot },
        { label: t('labels.supportStatus.QUEUED'), value: summary.data?.queued, tone: 'warning' },
        { label: t('labels.supportStatus.ASSIGNED'), value: summary.data?.assigned },
        { label: t('labels.supportStatus.RESOLVED'), value: summary.data?.resolved },
        { label: t('admin.support.average'), value: average == null ? undefined : Math.round(average * 10) / 10 },
        { label: t('admin.support.surveys'), value: summary.data?.surveys },
      ]} />
      <SegmentedControl label={t('admin.support.statusFilter')} value={status} onChange={(next) => setFilter('status', next)} options={[
        { value: '', label: t('admin.support.all') },
        ...STATUSES.map((value) => ({ value, label: t(`labels.supportStatus.${value}`) })),
      ]} />
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
                    <TableHead className="hidden pr-5 sm:table-cell">{t('admin.support.lastMessage')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-48 pl-5 sm:max-w-64">
                        <Link to={`/admin/support/${item.id}`} className="block truncate font-medium text-primary hover:underline">{item.userName}</Link>
                        <span className="block truncate text-xs text-muted-foreground">{item.lastText}</span>
                      </TableCell>
                      <TableCell><StatusBadge value={item.status} map={supportStatus} /></TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{item.agentName ?? '—'}</TableCell>
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
 * How support is doing, and each case with its survey, or where the assistant fails. Administrators read them but
 * don't take part.
 */
export function AdminSupportPage() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'bot' ? 'bot' : 'cases'
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.support.title')} description={t('admin.support.description')}
        actions={conversationId ? (
          <Button variant="outline" render={<Link to="/admin/support" />}><ArrowLeft /> {t('admin.support.back')}</Button>
        ) : undefined} />
      {conversationId ? <CaseDetail conversationId={conversationId} /> : (
        <>
          <SegmentedControl label={t('admin.support.view')} value={view}
            onChange={(next) => setParams(next === 'bot' ? { view: 'bot' } : {})} options={[
              { value: 'cases', label: t('admin.support.cases') },
              { value: 'bot', label: t('admin.support.bot') },
            ]} />
          {view === 'bot' ? <BotReport /> : <CaseList />}
        </>
      )}
    </div>
  )
}
