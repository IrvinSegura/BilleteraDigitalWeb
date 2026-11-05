import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/auth-context'
import { formatDateTime } from '@/lib/format'

function subscribe(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** Says when there is no connection, and how old the data on screen is when the app opened without one. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const { state } = useAuth()
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  const offlineSince = state.status === 'signed-in' ? state.offlineSince : undefined
  if (online && !offlineSince) return null
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border bg-muted px-4 py-3 text-sm">
      <WifiOff className="size-5 shrink-0 text-muted-foreground" />
      <p>
        <span className="font-medium">{t('layout.offlineTitle')}</span>{' '}
        <span className="text-muted-foreground">
          {offlineSince
            ? t('layout.offlineSaved', { date: formatDateTime(new Date(offlineSince).toISOString()) })
            : t('layout.offlineStale')}
        </span>
      </p>
    </div>
  )
}
