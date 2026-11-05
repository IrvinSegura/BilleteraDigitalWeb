import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, LogOut, Monitor, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative } from '@/lib/format'

import { describeUserAgent } from './user-agent'

const sessionsKey = ['users', 'me', 'sessions'] as const

/** The devices signed in to the account, newest first, with a way to sign any of them out. */
export function SessionsCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sessions = useQuery({
    queryKey: sessionsKey,
    queryFn: () => unwrap(api.GET('/api/v1/users/me/sessions')),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionsKey })
  const revoke = useMutation({
    mutationFn: (sessionId: string) => unwrap(api.DELETE('/api/v1/users/me/sessions/{sessionId}', {
      params: { path: { sessionId } },
    })),
    onSuccess: () => toast.success(t('settings.sessions.revoked')),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  })
  const revokeOthers = useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/v1/users/me/sessions')),
    onSuccess: (result) => toast.success(t('settings.sessions.revokedOthers', { count: result.revoked ?? 0 })),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  })
  const others = sessions.data?.filter((s) => !s.current).length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sessions.title')}</CardTitle>
        <CardDescription>
          {t('settings.sessions.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.error ? <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} /> : !sessions.data ? (
          <Skeleton className="h-32" />
        ) : (
          <ul className="divide-y rounded-xl border">
            {sessions.data.map((s) => {
              const device = describeUserAgent(s.userAgent)
              const Icon = device.mobile ? Smartphone : Monitor
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {device.os ? t('settings.sessions.browserOn', { browser: device.browser, os: device.os }) : device.browser}
                      {s.current && (
                        <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">{t('settings.sessions.thisDevice')}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[s.ipAddress, t('settings.sessions.lastUsed', { when: formatRelative(s.lastUsedAt ?? s.startedAt) })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {!s.current && (
                    <Button variant="ghost" size="sm" disabled={revoke.isPending && revoke.variables === s.id}
                      onClick={() => revoke.mutate(s.id!)} aria-label={t('settings.sessions.revokeLabel', { browser: device.browser })}>
                      {revoke.isPending && revoke.variables === s.id ? <Loader2 className="animate-spin" /> : t('common.close')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      {others > 0 && (
        <CardFooter className="justify-end">
          <Button variant="outline" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
            {revokeOthers.isPending ? <Loader2 className="animate-spin" /> : <LogOut />} {t('settings.sessions.revokeOthers')}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
