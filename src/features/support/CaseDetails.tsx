import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Loader2, NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState, FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { ListSkeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, formatRelative, shortId } from '@/lib/format'
import { caseResolution, supportStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { CaseCustomer } from './CaseCustomer'
import { CaseOperations } from './CaseOperations'

// The API's limit for a note
const MAX_NOTE = 1000

const caseKey = (conversationId: string) => ['support', 'inbox', 'case', conversationId] as const

/** The customer's earlier cases with people, to see whether they come back with the same problem. */
export function CaseHistory({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const history = useQuery({
    queryKey: [...caseKey(conversationId), 'history'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations/{conversationId}/history', { params: { path: { conversationId } } })),
  })
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="size-4" /> {t('support.inbox.history.title')}</CardTitle>
        <CardDescription>{t('support.inbox.history.hint')}</CardDescription>
      </CardHeader>
      <CardContent>
        {history.isPending ? <ListSkeleton rows={2} /> : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : history.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('support.inbox.history.empty')}</p>
        ) : (
          <ol className="grid gap-3">
            {history.data.map((item) => (
              <li key={item.id} className="grid gap-1 rounded-lg border px-3 py-2.5">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{shortId(item.id)}</span>
                  <StatusBadge value={item.status} map={supportStatus} />
                  <StatusBadge value={item.resolution} map={caseResolution} />
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                </span>
                {item.lastText && <span className="line-clamp-2 text-sm">{item.lastText}</span>}
                {item.agentName && <span className="text-xs text-muted-foreground">{t('support.inbox.history.attendedBy', { name: item.agentName })}</span>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

/** What the team writes on the case for each other; the customer never reads it. */
export function CaseNotes({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const key = [...caseKey(conversationId), 'notes']
  const path = { params: { path: { conversationId } } }
  const notes = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations/{conversationId}/notes', path)),
  })
  const add = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/notes', { ...path, body: { text: text.trim() } })),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next)
      setText('')
      toast.success(t('support.inbox.notes.added'))
    },
  })
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><NotebookPen className="size-4" /> {t('support.inbox.notes.title')}</CardTitle>
        <CardDescription>{t('support.inbox.notes.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notes.isPending ? <ListSkeleton rows={2} /> : notes.isError ? (
          <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
        ) : notes.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('support.inbox.notes.empty')}</p>
        ) : (
          <ol className="grid gap-2">
            {notes.data.map((note) => (
              <li key={note.id} className="rounded-lg border-l-4 border-warning/60 bg-warning/5 px-3 py-2">
                <p className="text-sm whitespace-pre-wrap break-words">{note.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note.authorName} · {formatRelative(note.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <FormField label={t('support.inbox.notes.field')}>
            {(field) => (
              <textarea {...field} rows={3} maxLength={MAX_NOTE} value={text} placeholder={t('support.inbox.notes.placeholder')}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
            )}
          </FormField>
          <FormError message={add.isError ? errorMessage(add.error) : null} />
          <Button type="submit" variant="outline" className="justify-self-end" disabled={!text.trim() || add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" />} {t('support.inbox.notes.add')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type Tab = 'customer' | 'operations' | 'history' | 'notes'

/**
 * Everything about the case besides the chat, one panel at a time. Where the customer's account stands is only there
 * while the case is open; once it closes, what was escalated is what matters.
 */
export function CaseDetails({ conversationId, active }: { conversationId: string; active: boolean }) {
  const { t } = useTranslation()
  const tabs: Tab[] = active ? ['customer', 'operations', 'history', 'notes'] : ['operations', 'history', 'notes']
  const [picked, setPicked] = useState<Tab>(tabs[0]!)
  const tab = tabs.includes(picked) ? picked : tabs[0]!
  return (
    <section aria-label={t('support.inbox.tabs.label')} className="grid gap-3">
      <div role="tablist" aria-label={t('support.inbox.tabs.label')} className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {tabs.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setPicked(value)}
            className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {t(`support.inbox.tabs.${value}`)}
          </button>
        ))}
      </div>
      {/* Above the chat: a long panel scrolls by itself instead of pushing the conversation out of sight */}
      <div role="tabpanel" className="scrollbar-thin max-h-[26rem] overflow-y-auto overscroll-contain rounded-xl">
        {tab === 'customer' && <CaseCustomer conversationId={conversationId} />}
        {tab === 'operations' && <CaseOperations conversationId={conversationId} active={active} />}
        {tab === 'history' && <CaseHistory conversationId={conversationId} />}
        {tab === 'notes' && <CaseNotes conversationId={conversationId} />}
      </div>
    </section>
  )
}
