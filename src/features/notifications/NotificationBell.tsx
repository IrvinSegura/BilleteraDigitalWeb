import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useNotifications, useUnreadCount } from '@/api/queries'
import { ListSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { NotificationItem } from './NotificationItem'
import { useNotificationActions } from './use-notification-actions'

export function UnreadDot({ count }: { count: number }) {
  if (count <= 0) {
    return null
  }
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold text-white ring-2 ring-background tabular">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function Latest({ onNavigate }: { onNavigate: () => void }) {
  const { data, isPending } = useNotifications(false, 0, 6)
  const { open, markAllRead } = useNotificationActions()
  const items = data?.items ?? []
  const anyUnread = items.some((n) => !n.read)
  const { t } = useTranslation()
  return (
    <div>
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <p className="text-sm font-semibold">{t('notifications.title')}</p>
        {anyUnread && (
          <Button variant="ghost" size="xs" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck /> {t('notifications.markAllReadShort')}
          </Button>
        )}
      </div>
      <div className="max-h-[22rem] overflow-y-auto p-1">
        {isPending ? <ListSkeleton rows={3} /> : items.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">{t('notifications.empty.noneShort')}</p>
        ) : items.map((n) => (
          <NotificationItem key={n.id} compact notification={n} onOpen={(item) => { onNavigate(); open(item) }} />
        ))}
      </div>
      <div className="border-t p-1">
        <Link to="/notifications" onClick={onNavigate} className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-muted">
          {t('notifications.seeAll')}
        </Link>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount().data?.count ?? 0
  const { t } = useTranslation()
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={unread ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')}
      >
        <Bell />
        <UnreadDot count={unread} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        {/* Mounted only while open, so the list is fetched when wanted */}
        {open && <Latest onNavigate={() => setOpen(false)} />}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
