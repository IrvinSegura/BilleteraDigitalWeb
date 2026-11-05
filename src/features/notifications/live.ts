import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { refreshSession } from '@/api/client'
import { session } from '@/api/session'
import i18n from '@/i18n'
import { setLiveConnected as setConnected } from '@/lib/live-status'

import { parseEventStream } from './event-stream'
import { notificationTitle } from './notification-text'

const baseUrl = import.meta.env.VITE_API_URL ?? ''
const MAX_BACKOFF_MS = 30_000

// The user started these themselves and already saw them succeed
const QUIET_TYPES = new Set(['TRANSFER_SENT'])

/**
 * Keeps a server-sent event stream open while the tab is visible and refreshes the inbox, balances and movements
 * as each notification arrives, with a toast for what the user didn't do themselves. EventSource can't send the
 * access token, so the stream is read with fetch. It reconnects after the server closes it (every few minutes) or
 * after a failure, waiting longer each time, and catches up on what it missed by refetching.
 */
export function useLiveNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let controller: AbortController | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let everConnected = false
    let stopped = false

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
      void queryClient.invalidateQueries({ queryKey: ['transfers'] })
    }

    function handle(event: string, data: string) {
      if (event === 'ready') {
        failures = 0
        setConnected(true)
        // Notifications may have arrived while disconnected
        if (everConnected) refresh()
        everConnected = true
      }
      if (event === 'notification') {
        refresh()
        try {
          const notification = JSON.parse(data) as { type?: string; title?: string }
          if (notification.title && !QUIET_TYPES.has(notification.type ?? '')) {
            toast.info(notificationTitle(notification.type, notification.title, i18n.resolvedLanguage ?? 'es'))
          }
        } catch {
          // A malformed event still refreshed the data
        }
      }
    }

    async function connect(renewed = false): Promise<'closed' | 'failed' | 'signed-out'> {
      const token = session.accessToken()
      if (!token) return 'signed-out'
      controller = new AbortController()
      const response = await fetch(`${baseUrl}/api/v1/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        credentials: 'include',
        signal: controller.signal,
      })
      if (response.status === 401 && !renewed) {
        // The access token expired: renew it once, like any other call
        return (await refreshSession()) ? connect(true) : 'signed-out'
      }
      if (!response.ok || !response.body) return 'failed'
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return 'closed'
        const parsed = parseEventStream(buffer + value)
        buffer = parsed.rest
        parsed.events.forEach((e) => handle(e.event, e.data))
      }
    }

    function start() {
      if (stopped || controller || document.visibilityState !== 'visible') return
      void connect()
        .catch(() => 'failed' as const)
        .then((outcome) => {
          controller = null
          setConnected(false)
          if (stopped || outcome === 'signed-out' || document.visibilityState !== 'visible') return
          // The server ends each stream after a while: reconnect at once; after a failure, back off
          const delay = outcome === 'closed' ? 0 : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures++)
          retryTimer = setTimeout(start, delay)
        })
    }

    // A hidden tab lets go of its stream; coming back reconnects and catches up
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        clearTimeout(retryTimer)
        start()
      } else {
        controller?.abort()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      controller?.abort()
      setConnected(false)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [queryClient])
}
