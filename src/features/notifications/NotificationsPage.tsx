import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
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
  const { open, markAllRead, remove, removeRead } = useNotificationActions()
  const items = notifications.data?.items ?? []
  const { t } = useTranslation()

  const anyRead = items.some((n) => n.read)
  const onError = (error: unknown) => toast.error(errorMessage(error))

  const filters = [
    { value: false, label: t('notifications.all') },
    { value: true, label: unread ? t('notifications.unreadCount', { count: unread }) : t('notifications.unread') },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
        actions={(unread > 0 || anyRead) && (
          <div className="flex flex-wrap gap-2">
            {anyRead && (
              <Button variant="outline" disabled={removeRead.isPending}
                onClick={() => removeRead.mutate(undefined, { onSuccess: () => { toast.success(t('notifications.deletedRead')); setPage(0) }, onError })}>
                <Trash2 /> {t('notifications.deleteRead')}
              </Button>
            )}
            {unread > 0 && (
              <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                <CheckCheck /> {t('notifications.markAllRead')}
              </Button>
            )}
          </div>
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
            {items.map((n) => (
              // The delete button sits beside the notice, not in it: the notice itself is a button
              <div key={n.id} className="flex items-center">
                <div className="min-w-0 flex-1"><NotificationItem notification={n} onOpen={open} /></div>
                <Button variant="ghost" size="icon-sm" className="mr-2 shrink-0 text-muted-foreground sm:mr-3" aria-label={t('notifications.delete')}
                  disabled={remove.isPending && remove.variables === n.id}
                  onClick={() => remove.mutate(n.id!, {
                    onSuccess: () => {
                      toast.success(t('notifications.deleted'))
                      // The last one of a later page: show the page before instead of an empty one
                      if (items.length === 1 && page > 0) setPage(page - 1)
                    },
                    onError,
                  })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Pager page={page} hasNext={!!notifications.data?.hasNext} onPageChange={setPage} disabled={notifications.isFetching} />
      </Card>
    </div>
  )
}
