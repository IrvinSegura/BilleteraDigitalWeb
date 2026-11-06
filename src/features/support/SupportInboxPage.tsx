import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCheck, Inbox, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatRelative } from '@/lib/format'
import { supportStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { ChatComposer } from './ChatComposer'
import { ChatThread } from './ChatThread'
import { attachmentForm, pollsWhileOpen } from './support-api'

const PAGE_SIZE = 20
// A new case or queue arriving is less urgent than a message in the case at hand
const LIST_POLL_MS = 5_000
const INBOX_KEY = ['support', 'inbox'] as const

function CaseList({ selected }: { selected?: string }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const cases = useQuery({
    queryKey: [...INBOX_KEY, 'list', page],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations', { params: { query: { page, size: PAGE_SIZE } } })),
    placeholderData: keepPreviousData,
    refetchInterval: LIST_POLL_MS,
  })
  const items = cases.data?.items ?? []

  return (
    <Card className={cn('gap-0 self-start py-0', selected && 'hidden lg:flex')}>
      {cases.isPending ? <ListSkeleton rows={4} /> : cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => cases.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Inbox} title={t('support.inbox.emptyTitle')} description={t('support.inbox.emptyHint')} />
      ) : (
        <ul className="divide-y">
          {items.map((item: Schemas['ConversationSummaryResponse']) => (
            <li key={item.id}>
              <Link to={`/support/inbox/${item.id}`} aria-current={item.id === selected ? 'page' : undefined}
                className={cn('block space-y-1 px-4 py-3 transition-colors hover:bg-muted/60', item.id === selected && 'bg-muted')}>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{item.userName}</span>
                  <StatusBadge value={item.status} map={supportStatus} />
                </span>
                <span className="block truncate text-xs text-muted-foreground">{item.lastText ?? t('support.inbox.noText')}</span>
                <span className="block text-xs text-muted-foreground">{formatRelative(item.lastMessageAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(page > 0 || cases.data?.hasNext) && (
        <Pager page={page} hasNext={!!cases.data?.hasNext} onPageChange={setPage} disabled={cases.isFetching} />
      )}
    </Card>
  )
}

function CaseChat({ conversationId }: { conversationId: string }) {
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
    void queryClient.invalidateQueries({ queryKey: [...INBOX_KEY, 'summary'] })
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
  const resolve = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/resolve', path)),
    onSuccess: update,
  })

  if (conversation.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (conversation.isError) return <Card><ErrorState error={conversation.error} onRetry={() => conversation.refetch()} /></Card>
  const data = conversation.data
  const active = data.status === 'ASSIGNED'
  const busy = reply.isPending || attach.isPending || resolve.isPending
  const failed = [reply, attach, resolve].find((action) => action.isError)

  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t('support.inbox.back')} render={<Link to="/support/inbox" />}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{data.userName}</h2>
          <StatusBadge value={data.status} map={supportStatus} />
        </div>
        {active && (
          <Button variant="outline" disabled={busy} onClick={() => resolve.mutate()}>
            {resolve.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />} {t('support.inbox.resolve')}
          </Button>
        )}
      </div>
      <ChatThread conversation={data} reader="staff" />
      {active ? (
        <ChatComposer pending={busy} error={failed ? errorMessage(failed.error) : null} placeholder={t('support.inbox.placeholder')}
          onSend={(text) => reply.mutateAsync(text)} onAttach={(file, text) => attach.mutateAsync({ file, text })} />
      ) : (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">{t('support.inbox.closed')}</p>
      )}
    </Card>
  )
}

/** A support agent's cases: the one they are attending, with everything said to the bot, and the ones they closed. */
export function SupportInboxPage() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const summary = useQuery({
    queryKey: [...INBOX_KEY, 'summary'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/summary')),
    refetchInterval: LIST_POLL_MS,
  })
  const active = summary.data?.activeConversationId

  return (
    <div className="space-y-6">
      <PageHeader title={t('support.inbox.title')}
        description={summary.data ? t('support.inbox.queued', { count: summary.data.queued ?? 0 }) : t('support.inbox.description')}
        actions={active && active !== conversationId ? (
          <Button render={<Link to={`/support/inbox/${active}`} />}>{t('support.inbox.openActive')}</Button>
        ) : undefined} />
      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <CaseList selected={conversationId} />
        {conversationId ? <CaseChat key={conversationId} conversationId={conversationId} /> : (
          <Card className="hidden lg:flex">
            <EmptyState icon={Inbox} title={t('support.inbox.pickTitle')} description={t('support.inbox.pickHint')} />
          </Card>
        )}
      </div>
    </div>
  )
}
