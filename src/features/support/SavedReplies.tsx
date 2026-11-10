import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState, FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { ListSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { MAX_TEXT_LENGTH } from './support-api'

const REPLIES_KEY = ['support', 'inbox', 'replies'] as const
// The API's limit
const MAX_TITLE = 60
// The API refuses these in a title or a text
const MARKUP = /[<>]/

/**
 * The answers an agent keeps to send again. Picking one writes it in the message, where it can still be changed;
 * what is being written starts as the text of a new one, so a good answer can be kept as it is typed.
 */
export function SavedReplies({ draft, onPick, disabled }: { draft: string; onPick: (text: string) => void; disabled: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const replies = useQuery({
    queryKey: REPLIES_KEY,
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/replies')),
    enabled: open,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: REPLIES_KEY })
  const save = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/replies', { body: { title: title.trim(), text: text.trim() } })),
    onSuccess: async () => {
      toast.success(t('support.inbox.replies.saved'))
      setTitle('')
      setText('')
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (replyId: string) => unwrap(api.DELETE('/api/v1/support/agent/replies/{replyId}', { params: { path: { replyId } } })),
    onSuccess: refresh,
  })
  const failed = [save, remove].find((action) => action.isError)

  function submit(event: React.FormEvent) {
    // The dialog sits inside the composer's form in the tree it renders from
    event.preventDefault()
    event.stopPropagation()
    if (MARKUP.test(title) || MARKUP.test(text)) {
      setProblem(t('support.noMarkup'))
      return
    }
    setProblem(null)
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next)
      setProblem(null)
      save.reset()
      remove.reset()
      if (next) setText((current) => current || draft.trim())
    }}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground" disabled={disabled}
        aria-label={t('support.inbox.replies.open')} title={t('support.inbox.replies.open')} />}>
        <Bookmark />
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-6 sm:max-w-lg">
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('support.inbox.replies.title')}</DialogTitle>
            <DialogDescription>{t('support.inbox.replies.hint')}</DialogDescription>
          </DialogHeader>
          {replies.isPending ? <ListSkeleton rows={2} /> : replies.isError ? (
            <ErrorState error={replies.error} onRetry={() => replies.refetch()} />
          ) : replies.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('support.inbox.replies.empty')}</p>
          ) : (
            <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border">
              {replies.data.map((reply) => (
                <li key={reply.id} className="flex items-center gap-1 pr-1">
                  <button type="button" className="min-w-0 flex-1 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    aria-label={t('support.inbox.replies.use', { title: reply.title })}
                    onClick={() => { onPick(reply.text ?? ''); setOpen(false) }}>
                    <span className="block truncate text-sm font-medium">{reply.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{reply.text}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={remove.isPending}
                    aria-label={t('support.inbox.replies.remove', { title: reply.title })} onClick={() => remove.mutate(reply.id!)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form className="grid gap-3 border-t pt-4" onSubmit={submit}>
            <h3 className="text-sm font-medium">{t('support.inbox.replies.newTitle')}</h3>
            <FormField label={t('support.inbox.replies.titleField')} hint={t('support.inbox.replies.titleHint')}>
              {(field) => <Input {...field} required maxLength={MAX_TITLE} value={title} onChange={(event) => setTitle(event.target.value)} />}
            </FormField>
            <FormField label={t('support.inbox.replies.textField')} hint={t('support.inbox.replies.textHint')}>
              {(field) => (
                <textarea {...field} required maxLength={MAX_TEXT_LENGTH} rows={3} value={text} onChange={(event) => setText(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
              )}
            </FormField>
            <FormError message={problem ?? (failed ? errorMessage(failed.error) : null)} />
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={!title.trim() || !text.trim() || save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />} {t('support.inbox.replies.save')}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
