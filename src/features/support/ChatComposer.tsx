import { Loader2, Paperclip, Send } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormError } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'

import { ACCEPTED_FILES, MAX_FILE_BYTES, MAX_TEXT_LENGTH } from './support-api'

// The API refuses these, and a person can type them without meaning anything by it
const MARKUP = /[<>]/

/** Where a message is written, or a file picked, in any chat. Empties itself once what it sent arrives. */
export function ChatComposer({ placeholder, pending, error, onSend, onAttach }: {
  placeholder: string
  pending: boolean
  error?: string | null
  onSend: (text: string) => Promise<unknown>
  onAttach: (file: File, text: string) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const trimmed = text.trim()

  // Grows with what is written, up to the CSS maximum, and shrinks back when it empties
  useLayoutEffect(() => {
    if (box.current) {
      box.current.style.height = 'auto'
      box.current.style.height = `${box.current.scrollHeight}px`
    }
  }, [text])

  function hasMarkup() {
    if (MARKUP.test(text)) {
      setProblem(t('support.noMarkup'))
      return true
    }
    return false
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (!trimmed || pending || hasMarkup()) return
    setProblem(null)
    await onSend(trimmed)
      .then(() => setText(''))
      // The screen shows what went wrong; what was written stays, to try again
      .catch(() => undefined)
  }

  async function attach(file: File | undefined) {
    if (picker.current) picker.current.value = ''
    if (!file || pending || hasMarkup()) return
    if (file.size > MAX_FILE_BYTES) {
      setProblem(t('support.fileTooBig'))
      return
    }
    if (!ACCEPTED_FILES.split(',').includes(file.type)) {
      setProblem(t('support.fileType'))
      return
    }
    setProblem(null)
    await onAttach(file, trimmed)
      .then(() => setText(''))
      .catch(() => undefined)
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <form onSubmit={(event) => void send(event)} className="space-y-2 border-t p-3 sm:p-4">
      <FormError message={problem ?? error} />
      <div className="flex items-end gap-1 rounded-2xl border border-input bg-background p-1.5 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        <input ref={picker} type="file" hidden accept={ACCEPTED_FILES} data-testid="support-file"
          onChange={(event) => void attach(event.target.files?.[0])} />
        <Button type="button" variant="ghost" size="icon" className="rounded-full text-muted-foreground" disabled={pending}
          aria-label={t('support.attach')} title={t('support.attachHint')} onClick={() => picker.current?.click()}>
          <Paperclip />
        </Button>
        <textarea ref={box} rows={1} value={text} maxLength={MAX_TEXT_LENGTH} placeholder={placeholder} aria-label={t('support.message')}
          onChange={(event) => { setText(event.target.value); setProblem(null) }} onKeyDown={sendOnEnter}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground" />
        <Button type="submit" size="icon" className="rounded-full" disabled={!trimmed || pending} aria-label={t('support.send')}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
      <p className="hidden px-2 text-xs text-muted-foreground sm:block">{t('support.composerHint')}</p>
    </form>
  )
}
