import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useNotifications, useUnreadCount } from '@/api/queries'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Pager } from '@/components/Pager'
import { ListSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { NotificationItem } from './NotificationItem'
import { useNotificationActions } from './use-notification-actions'

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const notifications = useNotifications(unreadOnly, page)
  const unread = useUnreadCount().data?.count ?? 0
  const { open, markAllRead } = useNotificationActions()
  const items = notifications.data?.items ?? []
  const { t } = useTranslation()

  const filters = [
    { value: false, label: t('notifications.all') },
    { value: true, label: unread ? t('notifications.unreadCount', { count: unread }) : t('notifications.unread') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
        actions={unread > 0 && (
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck /> {t('notifications.markAllRead')}
          </Button>
        )}
      />
      <SegmentedControl label={t('notifications.show')} options={filters} value={unreadOnly}
        onChange={(value) => { setUnreadOnly(value); setPage(0) }} />
      <Card className="gap-0 py-0">
        {notifications.isPending ? <ListSkeleton rows={5} /> : notifications.isError ? (
          <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title={t(unreadOnly ? 'notifications.empty.upToDate' : 'notifications.empty.none')}
            description={t(unreadOnly ? 'notifications.empty.upToDateHint' : 'notifications.empty.noneHint')} />
        ) : (
          <div className={cn('divide-y', notifications.isPlaceholderData && 'opacity-60')}>
            {items.map((n) => <NotificationItem key={n.id} notification={n} onOpen={open} />)}
          </div>
        )}
        <Pager page={page} hasNext={!!notifications.data?.hasNext} onPageChange={setPage} disabled={notifications.isFetching} />
      </Card>
    </div>
  )
}
