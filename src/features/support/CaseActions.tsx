import { useMutation } from '@tanstack/react-query'
import { CheckCheck, GraduationCap, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import type { Conversation } from './support-api'

type Reason = NonNullable<Schemas['CaseResolveRequest']['reason']>

// What an agent can pick; the customer closing it themself is recorded on its own
const REASONS: Reason[] = ['SOLVED', 'INFORMATION', 'TICKET', 'NO_REPLY', 'DUPLICATE', 'OTHER']
// The API's limits
const MAX_QUESTION = 300
const MAX_ANSWER = 2000

const textareaClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** Closes the case saying how it ended, for the team's reports. */
export function ResolveCase({ conversationId, disabled, onResolved }: {
  conversationId: string
  disabled: boolean
  onResolved: (next: Conversation) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason>('SOLVED')
  const resolve = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/resolve', {
      params: { path: { conversationId } }, body: { reason },
    })),
    onSuccess: (next) => {
      setOpen(false)
      toast.success(t('support.inbox.resolveDialog.done'))
      onResolved(next)
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resolve.reset() }}>
      <DialogTrigger render={<Button disabled={disabled} />}><CheckCheck /> {t('support.inbox.resolve')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); resolve.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('support.inbox.resolveDialog.title')}</DialogTitle>
            <DialogDescription>{t('support.inbox.resolveDialog.hint')}</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('support.inbox.resolveDialog.reason')}</legend>
            {REASONS.map((value) => (
              <label key={value} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                reason === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/60')}>
                <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)}
                  className="size-4 accent-primary" />
                {t(`labels.caseResolution.${value}`)}
              </label>
            ))}
          </fieldset>
          <FormError message={resolve.isError ? errorMessage(resolve.error) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={resolve.isPending}>
              {resolve.isPending && <Loader2 className="animate-spin" />} {t('support.inbox.resolveDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// The last thing the customer and the agent wrote: usually the question and its answer
function lastFrom(conversation: Conversation, sender: string) {
  return [...(conversation.messages ?? [])].reverse().find((message) => message.sender === sender && message.text)?.text ?? ''
}

/** Proposes to the administrators that the assistant answer a question by itself, as the agent just did. */
export function TeachBot({ conversation, disabled }: { conversation: Conversation; disabled?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const conversationId = conversation.id!
  const send = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/bot-suggestions', {
      params: { path: { conversationId } }, body: { question: question.trim(), answer: answer.trim() },
    })),
    onSuccess: () => {
      setOpen(false)
      toast.success(t('support.inbox.teach.sent'))
    },
  })
  const start = (next: boolean) => {
    setOpen(next)
    if (next) {
      setQuestion(lastFrom(conversation, 'USER').slice(0, MAX_QUESTION))
      setAnswer(lastFrom(conversation, 'AGENT').slice(0, MAX_ANSWER))
    } else {
      send.reset()
    }
  }
  return (
    <Dialog open={open} onOpenChange={start}>
      <DialogTrigger render={<Button variant="ghost" disabled={disabled} />}><GraduationCap /> {t('support.inbox.teach.open')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-lg">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); send.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('support.inbox.teach.title')}</DialogTitle>
            <DialogDescription>{t('support.inbox.teach.hint')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('support.inbox.teach.question')}>
            {(field) => (
              <textarea {...field} required rows={2} maxLength={MAX_QUESTION} value={question}
                onChange={(e) => setQuestion(e.target.value)} className={textareaClass} />
            )}
          </FormField>
          <FormField label={t('support.inbox.teach.answer')}>
            {(field) => (
              <textarea {...field} required rows={5} maxLength={MAX_ANSWER} value={answer}
                onChange={(e) => setAnswer(e.target.value)} className={textareaClass} />
            )}
          </FormField>
          <FormError message={send.isError ? errorMessage(send.error) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => start(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!question.trim() || !answer.trim() || send.isPending}>
              {send.isPending && <Loader2 className="animate-spin" />} {t('support.inbox.teach.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
