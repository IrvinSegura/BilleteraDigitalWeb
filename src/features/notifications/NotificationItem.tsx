import { useTranslation } from 'react-i18next'

import type { Schemas } from '@/api/client'
import { formatRelative } from '@/lib/format'
import { defaultNotificationVisual, notificationVisuals, toneClasses } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { notificationText } from './notification-text'

export type Notification = Schemas['NotificationResponse']

export function NotificationItem({ notification, compact, onOpen }: {
  notification: Notification
  compact?: boolean
  onOpen?: (notification: Notification) => void
}) {
  const { icon: Icon, tone } = notificationVisuals[notification.type ?? ''] ?? defaultNotificationVisual
  const unread = !notification.read
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'es'
  const { title, body } = notificationText(notification, language)
  return (
    <button
      type="button"
      onClick={() => onOpen?.(notification)}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
        compact ? 'rounded-lg px-2.5 py-2.5' : 'px-4 py-4 sm:px-5',
      )}
    >
      <span className={cn('flex shrink-0 items-center justify-center rounded-full', toneClasses[tone], compact ? 'size-8' : 'size-10')}>
        <Icon className={compact ? 'size-4' : 'size-[1.1rem]'} />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-start justify-between gap-3">
          <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium text-foreground/85')}>{title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(notification.createdAt)}</span>
        </span>
        <span className={cn('block text-sm text-muted-foreground', compact && 'line-clamp-2')}>{body}</span>
      </span>
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} aria-label={unread ? t('notifications.unread') : undefined} />
    </button>
  )
}
