import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Download, FileText, Loader2, Play, UserRound } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, unwrap } from '@/api/client'
import { Button } from '@/components/ui/button'
import { formatDate, formatTime, initials } from '@/lib/format'
import { labelOf } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { type Attachment, type Conversation, formatFileSize, type Message } from './support-api'

/** Who is reading: their own messages go on the right, and the others are named from their point of view. */
export type ChatReader = 'user' | 'staff'

// Messages of the same person this close together read as one, so only the first says who and when
const GROUP_WINDOW_MS = 5 * 60_000
const DAY_MS = 86_400_000

function attachmentQuery(id: string) {
  return {
    queryKey: ['support', 'attachment', id],
    queryFn: () => unwrap<Blob>(api.GET('/api/v1/support/attachments/{attachmentId}', {
      params: { path: { attachmentId: id } },
      parseAs: 'blob',
    }) as never),
    // A file never changes
    staleTime: Infinity,
  }
}

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return undefined
    const created = URL.createObjectURL(blob)
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [blob])
  return url
}

// The API only hands files to whoever shows a token, so they come as data rather than as a link
function AttachmentView({ attachment }: { attachment: Attachment }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const type = attachment.contentType ?? ''
  const isImage = type.startsWith('image/')
  const [playing, setPlaying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const file = useQuery({ ...attachmentQuery(attachment.id!), enabled: isImage || playing })
  const url = useObjectUrl(file.data)

  async function download() {
    setDownloading(true)
    try {
      const blob = await queryClient.fetchQuery(attachmentQuery(attachment.id!))
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = attachment.fileName ?? 'file'
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      {isImage && url && <img src={url} alt={attachment.fileName} className="max-h-72 rounded-lg" />}
      {playing && url && <video src={url} controls autoPlay className="max-h-72 rounded-lg" aria-label={attachment.fileName} />}
      <div className="flex items-center gap-2 rounded-lg bg-background p-2 text-foreground">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-xs">
          <span className="block truncate font-medium">{attachment.fileName}</span>
          <span className="text-muted-foreground">{formatFileSize(attachment.sizeBytes)}</span>
        </span>
        {type === 'video/mp4' && !playing && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t('support.play', { name: attachment.fileName })} onClick={() => setPlaying(true)}>
            <Play />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-sm" disabled={downloading}
          aria-label={t('support.download', { name: attachment.fileName })} onClick={() => void download()}>
          {downloading ? <Loader2 className="animate-spin" /> : <Download />}
        </Button>
      </div>
      {file.isError && <p role="alert" className="text-xs text-destructive">{t('support.attachmentError')}</p>}
    </div>
  )
}

// The bot's answers come from Markdown files, where **this** names a button
function withBold(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))
}

/** Who said it: the bot's icon, or a person's initials. */
export function ChatAvatar({ name, bot, className }: { name?: string; bot?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
      bot ? 'bg-primary/15 text-primary' : 'bg-accent text-accent-foreground', className)}>
      {bot ? <Bot className="size-4" /> : initials(name ?? '') || <UserRound className="size-4" />}
    </span>
  )
}

function ChipButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="rounded-full border bg-background px-3 py-1.5 text-left text-sm font-medium text-primary transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50">
      {children}
    </button>
  )
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-xs text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span className="text-center">{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </li>
  )
}

function Bubble({ message, name, own, grouped, children }: {
  message: Message
  name: string
  own: boolean
  /** It continues the message before it, so it doesn't say again who wrote it. */
  grouped: boolean
  children?: ReactNode
}) {
  const text = message.text ?? ''
  const bot = message.sender === 'BOT'
  return (
    <li className={cn('flex gap-2.5', own && 'flex-row-reverse', grouped && '-mt-2')}>
      {!own && (grouped ? <span className="w-8 shrink-0" /> : <ChatAvatar name={name} bot={bot} />)}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[75%]', own && 'items-end')}>
        {!grouped && (
          <span className="px-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{name}</span> · {formatTime(message.createdAt)}
          </span>
        )}
        <div className={cn('space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap',
          own ? 'rounded-tr-md bg-primary text-primary-foreground' : 'rounded-tl-md bg-muted text-foreground')}>
          {message.attachment && <AttachmentView attachment={message.attachment} />}
          {text && <p>{bot ? withBold(text) : text}</p>}
        </div>
        {children}
      </div>
    </li>
  )
}

function Thinking() {
  const { t } = useTranslation()
  return (
    <li className="flex gap-2.5">
      <ChatAvatar bot />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-3.5 py-3.5">
        <span className="sr-only">{t('support.thinking')}</span>
        {[0, 150, 300].map((delay) => (
          <span key={delay} aria-hidden="true" style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce" />
        ))}
      </div>
    </li>
  )
}

function dayOf(message: Message) {
  return new Date(message.createdAt ?? 0).toDateString()
}

/** Everything said in a conversation, with the newest always in view. */
export function ChatThread({ conversation, reader, intro, quickQuestions, onQuestion, onPerson, thinking, busy, className, children }: {
  conversation: Conversation | null | undefined
  reader: ChatReader
  /** Shown first, as said by the bot. */
  intro?: string
  /** Offered while nothing has been said yet. */
  quickQuestions?: string[]
  /** Lets the reader pick what the bot offers, as if they had written it. */
  onQuestion?: (question: string) => void
  /** Lets the reader say that none of what the bot offers is what they meant. */
  onPerson?: () => void
  /** The bot is about to answer. */
  thinking?: boolean
  busy?: boolean
  className?: string
  /** What the reader can do next, after the last message. */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const log = useRef<HTMLDivElement>(null)
  const messages = conversation?.messages ?? []
  const hasFooter = !!children

  useEffect(() => {
    if (log.current) {
      log.current.scrollTop = log.current.scrollHeight
    }
  }, [messages.length, thinking, hasFooter])

  const nameOf = (message: Message) => {
    if (message.sender === 'BOT') return t('support.bot')
    if (message.sender === 'AGENT') return conversation?.agentName ?? t('support.agent')
    return reader === 'staff' ? (conversation?.userName ?? t('support.customer')) : t('support.you')
  }

  const dayLabel = (message: Message) => {
    const day = dayOf(message)
    if (day === new Date().toDateString()) return t('support.today')
    if (day === new Date(Date.now() - DAY_MS).toDateString()) return t('support.yesterday')
    return formatDate(message.createdAt)
  }

  const suggestionsOf = (message: Message, last: boolean) => {
    const suggestions = message.suggestions ?? []
    if (suggestions.length === 0) return null
    // The agent sees what was offered, as part of the context; for the user only the latest can still be picked
    if (reader === 'staff') {
      return <p className="px-1 text-xs text-muted-foreground">{t('support.offered', { questions: suggestions.join(' · ') })}</p>
    }
    if (!last || conversation?.status !== 'BOT' || !onQuestion) return null
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {suggestions.map((question) => (
          <ChipButton key={question} disabled={busy} onClick={() => onQuestion(question)}>{question}</ChipButton>
        ))}
        {onPerson && <ChipButton disabled={busy} onClick={onPerson}>{t('support.noneOfThese')}</ChipButton>}
      </div>
    )
  }

  return (
    <div ref={log} role="log" aria-label={t('support.threadLabel')} tabIndex={0}
      className={cn('overflow-y-auto p-4 outline-none sm:p-5', className ?? 'max-h-[60svh] min-h-64 flex-1')}>
      <ol className="flex flex-col gap-4">
        {intro && (
          <li className="flex gap-2.5">
            <ChatAvatar bot />
            <div className="flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[75%]">
              <span className="px-1 text-xs font-medium text-foreground/80">{t('support.bot')}</span>
              <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">{intro}</div>
              {messages.length === 0 && (!conversation || conversation.status === 'BOT') && !!quickQuestions?.length && onQuestion && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {quickQuestions.map((question) => (
                    <ChipButton key={question} disabled={busy} onClick={() => onQuestion(question)}>{question}</ChipButton>
                  ))}
                </div>
              )}
            </div>
          </li>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const newDay = !previous || dayOf(previous) !== dayOf(message)
          const grouped = !newDay && !!previous && previous.sender === message.sender && message.sender !== 'SYSTEM'
            && new Date(message.createdAt ?? 0).getTime() - new Date(previous.createdAt ?? 0).getTime() < GROUP_WINDOW_MS
          return (
            <Fragment key={message.id}>
              {newDay && <Divider>{dayLabel(message)}</Divider>}
              {message.sender === 'SYSTEM' ? (
                <Divider>{labelOf('support.events', message.event ?? '')}</Divider>
              ) : (
                <Bubble message={message} name={nameOf(message)} grouped={grouped}
                  own={message.sender === (reader === 'user' ? 'USER' : 'AGENT')}>
                  {suggestionsOf(message, index === messages.length - 1)}
                </Bubble>
              )}
            </Fragment>
          )
        })}
        {thinking && <Thinking />}
      </ol>
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </div>
  )
}
