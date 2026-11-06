import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Clock, Headset, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { ChatComposer } from './ChatComposer'
import { ChatAvatar, ChatThread } from './ChatThread'
import { attachmentForm, type Conversation, SUPPORT_QUERY_KEY, useConversation } from './support-api'
import { SurveyForm } from './SurveyForm'

/** Who the user is talking to, and what they can do about it. */
function ChatHeader({ conversation, children }: { conversation: Conversation | null; children?: ReactNode }) {
  const { t } = useTranslation()
  const status = conversation?.status
  const attended = status === 'ASSIGNED'
  const queued = status === 'QUEUED'
  const ended = status === 'RESOLVED'
  const title = attended ? conversation?.agentName : queued ? t('support.queueTitle') : ended ? t('support.ended') : t('support.bot')
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-5">
      <div className="relative shrink-0">
        {attended ? <ChatAvatar name={conversation?.agentName} className="size-10 text-sm" />
          : queued ? (
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-warning/15 text-warning-foreground dark:text-warning">
              <Clock className="size-5" />
            </span>
          ) : ended ? (
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CircleCheck className="size-5" />
            </span>
          ) : <ChatAvatar bot className="size-10" />}
        {(attended || !status || status === 'BOT') && (
          <span aria-hidden="true" className="absolute right-0 bottom-0 size-2.5 rounded-full bg-success ring-2 ring-card" />
        )}
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {attended || queued ? (
          <p role="status" className="text-xs text-muted-foreground">
            {attended ? t('support.assigned', { name: conversation?.agentName }) : t('support.queued', { position: conversation?.queuePosition })}
          </p>
        ) : !ended && <p className="text-xs text-muted-foreground">{t('support.botStatus')}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-1">{children}</div>}
    </div>
  )
}

/** The chat with support: the bot answers what it can, and a person attends the rest. */
export function SupportPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const conversation = useConversation()
  const [thanked, setThanked] = useState(false)
  const current = conversation.data ?? null
  const set = (next: Conversation | null | undefined) => {
    queryClient.setQueryData(SUPPORT_QUERY_KEY, next ?? null)
    setThanked(false)
  }

  const send = useMutation({
    mutationFn: (text: string) => unwrap(api.POST('/api/v1/support/conversation/messages', { body: { text } })),
    onSuccess: set,
  })
  const attach = useMutation({
    mutationFn: ({ file, text }: { file: File; text: string }) =>
      unwrap(api.POST('/api/v1/support/conversation/attachments', attachmentForm(file, text))),
    onSuccess: set,
  })
  const escalate = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/conversation/escalate')),
    onSuccess: set,
  })
  const close = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/conversation/close')),
    onSuccess: set,
  })

  if (conversation.isPending) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('support.title')} description={t('support.description')} />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }
  if (conversation.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('support.title')} description={t('support.description')} />
        <Card><ErrorState error={conversation.error} onRetry={() => conversation.refetch()} /></Card>
      </div>
    )
  }

  const open = !!current && current.status !== 'RESOLVED'
  const withBot = !current || current.status === 'BOT' || current.status === 'RESOLVED'
  const last = current?.messages?.at(-1)
  const asksFeedback = current?.status === 'BOT' && last?.asksFeedback
  const busy = send.isPending || attach.isPending || escalate.isPending || close.isPending
  const failed = [send, attach, escalate, close].find((action) => action.isError)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('support.title')} description={t('support.description')} />
      <Card className="h-[calc(100svh-19rem)] min-h-[28rem] lg:h-[calc(100svh-15rem)] gap-0 overflow-hidden py-0">
        <ChatHeader conversation={current}>
          {withBot && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => escalate.mutate()}>
              <Headset /> {t('support.talkToPerson')}
            </Button>
          )}
          {open && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => close.mutate()}>
              <X className="sm:hidden" /> <span className="max-sm:sr-only">{t('support.end')}</span>
            </Button>
          )}
        </ChatHeader>
        <ChatThread conversation={current} reader="user" intro={t('support.welcome')} className="min-h-0 flex-1"
          quickQuestions={[t('support.quick.deposit'), t('support.quick.withdraw'), t('support.quick.limit'), t('support.quick.currencies')]}
          onQuestion={(question) => send.mutate(question)} onPerson={() => escalate.mutate()}
          thinking={send.isPending && withBot} busy={busy}>
          {(asksFeedback || current?.awaitsSurvey || thanked) && (
            <>
              {asksFeedback && (
                <div className="flex flex-wrap items-center gap-2 pl-10.5">
                  <p className="text-sm font-medium">{t('support.helped')}</p>
                  <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => close.mutate()}>
                    <ThumbsUp /> {t('support.helpedYes')}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => escalate.mutate()}>
                    <ThumbsDown /> {t('support.helpedNo')}
                  </Button>
                </div>
              )}
              {current?.awaitsSurvey && (
                <SurveyForm onAnswered={() => { set(null); setThanked(true) }} />
              )}
              {thanked && <p role="status" className="text-center text-sm text-muted-foreground">{t('support.surveyThanks')}</p>}
            </>
          )}
        </ChatThread>
        <ChatComposer pending={busy} error={failed ? errorMessage(failed.error) : null}
          placeholder={t(current?.status === 'RESOLVED' ? 'support.placeholderNew' : 'support.placeholder')}
          onSend={(text) => send.mutateAsync(text)}
          onAttach={(file, text) => attach.mutateAsync({ file, text })} />
      </Card>
    </div>
  )
}
