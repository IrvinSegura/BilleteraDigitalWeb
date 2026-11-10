import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { api, BROWSER_SESSION, refreshSession, type Schemas, setSessionExpiredHandler, unwrap } from '@/api/client'
import { session } from '@/api/session'
import i18n, { currentLanguage } from '@/i18n'

import { type Auth, AuthContext, type AuthState, type Role, type User } from './auth-context'
import { clearSnapshot, restoreSnapshot, saveSnapshot } from './offline-snapshot'
import { announce, onSessionEvent } from './session-sync'

function toUser(me: Schemas['UserResponse']): User {
  return {
    id: me.id!,
    email: me.email!,
    fullName: me.fullName!,
    phone: me.phone,
    role: me.role as Role,
    emailVerified: me.emailVerified!,
    twoFactorEnabled: me.twoFactorEnabled!,
    mustChangePassword: me.mustChangePassword ?? false,
    language: me.language,
    createdAt: me.createdAt,
  }
}

async function fetchCurrentUser(): Promise<User> {
  return toUser(await unwrap(api.GET('/api/v1/users/me')))
}

/**
 * Provides useAuth. On load it restores the session from the refresh cookie (quietly signed out if it can't);
 * when an authenticated call later can't renew it, it signs out, clears the query cache and says so.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const signOutLocally = useCallback(() => {
    session.clear()
    clearSnapshot()
    queryClient.clear()
    setState((current) => ({
      status: 'signed-out',
      previousUserId: current.status === 'signed-in' ? current.user.id : current.status === 'signed-out' ? current.previousUserId : undefined,
    }))
  }, [queryClient])

  // Bumped by retry() to run the restore below again
  const [attempt, setAttempt] = useState(0)

  // A reload loses the in-memory access token: trade the refresh cookie for a new one and the user.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      // Never signed in on this browser (or signed out): no cookie to trade, so skip the doomed request
      if (!session.mayBeSignedIn()) {
        setState({ status: 'signed-out' })
        return
      }
      const restored = (await refreshSession()) ? await fetchCurrentUser() : null
      if (!cancelled) {
        setState(restored ? { status: 'signed-in', user: restored } : { status: 'signed-out' })
      }
    }
    // Only a refused refresh signs out; the API being down keeps the session for when it is back. Without a
    // connection at all (offline, so fetch failed), the data saved last time is shown, read-only.
    restore().catch((error: unknown) => {
      if (cancelled) return
      const saved = error instanceof TypeError && !navigator.onLine ? restoreSnapshot(queryClient) : null
      // The query client assumes a connection until the browser says it lost one; without this it would refetch
      // the restored data, fail and show errors instead
      if (saved) onlineManager.setOnline(false)
      setState(saved ? { status: 'signed-in', user: saved.user, offlineSince: saved.savedAt } : { status: 'unavailable' })
    })
    return () => {
      cancelled = true
    }
  }, [attempt, queryClient])

  // Keeps the snapshot current while signed in, at most every few seconds. Only after data arrives: right after
  // a reload the cache is still empty, and saving it then would wipe the snapshot.
  const user = state.status === 'signed-in' && !state.offlineSince ? state.user : null
  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || timer) return
      timer = setTimeout(() => {
        timer = undefined
        saveSnapshot(queryClient, user)
      }, 3000)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [queryClient, user])

  // The emails go out in the language the app shows: the last one chosen, on whichever device. If saving it fails the
  // emails just stay in the previous language until the next change or load.
  const emailLanguage = user?.language
  const signedInUser = !!user
  useEffect(() => {
    if (!signedInUser) return
    const sync = () => {
      const language = currentLanguage()
      if (language === emailLanguage) return
      void unwrap(api.PUT('/api/v1/users/me/language', { body: { language } }))
        .then((me) => setState((current) => (current.status === 'signed-in'
          ? { ...current, user: { ...current.user, language: me.language } }
          : current)))
        .catch(() => undefined)
    }
    sync()
    i18n.on('languageChanged', sync)
    return () => i18n.off('languageChanged', sync)
  }, [signedInUser, emailLanguage])

  // Back online after opening offline: start over with a real session, as a fresh load would
  const offline = state.status === 'signed-in' && !!state.offlineSince
  useEffect(() => {
    if (!offline) return
    const reload = () => window.location.reload()
    window.addEventListener('online', reload)
    return () => window.removeEventListener('online', reload)
  }, [offline])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      signOutLocally()
      toast.info(i18n.t('session.expired'))
    })
  }, [signOutLocally])

  // Signing out in one tab signs out all of them; signing in lets the tabs waiting on the login screen pick up
  // the new session from the shared cookie
  const signedOut = state.status === 'signed-out'
  useEffect(() => onSessionEvent((event) => {
    if (event === 'signed-out') {
      signOutLocally()
    } else if (signedOut) {
      retry()
    }
  }), [signOutLocally, retry, signedOut])

  const login = useCallback(async (email: string, password: string, twoFactorCode?: string, options?: { resendVerification?: boolean }) => {
    const tokens = await unwrap(api.POST('/api/v1/auth/login', {
      headers: BROWSER_SESSION,
      body: { email, password, twoFactorCode: twoFactorCode || undefined, resendVerification: options?.resendVerification || undefined },
    }))
    session.store(tokens.accessToken!)
    setState({ status: 'signed-in', user: await fetchCurrentUser() })
    announce('signed-in')
  }, [])

  const refreshUser = useCallback(async () => {
    const user = await fetchCurrentUser()
    setState({ status: 'signed-in', user })
  }, [])

  const updateProfile = useCallback(async (changes: { fullName?: string; phone?: string }) => {
    const me = await unwrap(api.PATCH('/api/v1/users/me', { body: changes }))
    setState({ status: 'signed-in', user: toUser(me) })
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const tokens = await unwrap(api.POST('/api/v1/users/me/password', {
      headers: BROWSER_SESSION,
      body: { currentPassword, newPassword },
    }))
    session.store(tokens.accessToken!)
  }, [])

  // Revokes the refresh token and clears its cookie on the server; signs out locally, and in every other tab,
  // even if that call fails.
  const logout = useCallback(async () => {
    await api.POST('/api/v1/auth/logout', { headers: BROWSER_SESSION }).catch(() => undefined)
    signOutLocally()
    announce('signed-out')
  }, [signOutLocally])

  const auth = useMemo<Auth>(
    () => ({ state, retry, login, refreshUser, updateProfile, changePassword, logout }),
    [state, retry, login, refreshUser, updateProfile, changePassword, logout],
  )
  return <AuthContext value={auth}>{children}</AuthContext>
}
