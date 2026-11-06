import { CloudOff, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'

import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'

import { useAuth } from './auth-context'

export function FullPageLoader() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4" role="status" aria-busy aria-label={t('common.loading')}>
      <LogoMark className="size-11 animate-pulse" />
    </div>
  )
}

function ServerUnavailable() {
  const { t } = useTranslation()
  const { retry } = useAuth()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CloudOff className="size-6" />
      </div>
      <div className="max-w-sm space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t('session.unavailableTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('session.unavailableHint')}</p>
      </div>
      <Button size="lg" onClick={retry}><RotateCw /> {t('common.retry')}</Button>
    </div>
  )
}

/** What /login keeps to send the user back. forUser is the account whose session ended on that page, if any. */
interface ReturnPage {
  from?: string
  forUser?: string
}

/**
 * Routes behind it need a session; while it's being restored, nothing flashes. Signed-out users go to /login,
 * which sends them back to the page they asked for.
 */
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <FullPageLoader />
  }
  if (state.status === 'unavailable') {
    return <ServerUnavailable />
  }
  if (state.status === 'signed-out') {
    const returnPage: ReturnPage = { from: location.pathname + location.search, forUser: state.previousUserId }
    return <Navigate to="/login" replace state={returnPage} />
  }
  return <Outlet />
}

/** Admin screens; anyone else is sent home (the API refuses them anyway). */
export function RequireAdmin() {
  const { state } = useAuth()
  if (state.status === 'signed-in' && state.user.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export function RequireSupport() {
  const { state } = useAuth()
  if (state.status === 'signed-in' && state.user.role !== 'SUPPORT') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

/** Sign-in screens; a signed-in user goes straight to the app. */
export function GuestOnly() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') {
    return <FullPageLoader />
  }
  if (state.status === 'signed-in') {
    const { from, forUser } = (location.state as ReturnPage | null) ?? {}
    // The page of a session that ended belongs to that account: anyone else signing in on this browser starts at home
    const samePerson = !forUser || forUser === state.user.id
    return <Navigate to={from && samePerson ? from : '/'} replace />
  }
  return <Outlet />
}
