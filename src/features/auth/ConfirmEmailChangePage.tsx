import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Link2Off, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { Logo } from '@/components/Logo'
import { buttonVariants } from '@/components/ui/button'

import { useLinkToken } from './token-link'

/**
 * Opened from the link sent to the new address, signed in or not. Confirming ends every session, this one included,
 * so a signed-in tab is signed out here instead of failing on its next call.
 */
export function ConfirmEmailChangePage() {
  const { t } = useTranslation()
  const token = useLinkToken()
  const { state, logout } = useAuth()
  const signedIn = state.status === 'signed-in'
  const confirm = useMutation({
    mutationFn: (value: string) => unwrap(api.POST('/api/v1/auth/email-change/confirm', { body: { token: value } })),
    onSuccess: () => signedIn && logout(),
  })
  const { mutate } = confirm
  // The token works once, and StrictMode runs effects twice in development: a second post would fail
  const sent = useRef(false)

  useEffect(() => {
    if (token && !sent.current) {
      sent.current = true
      mutate(token)
    }
  }, [token, mutate])

  const failed = !token || confirm.isError

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-4">
      <Logo />
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        {!confirm.isSuccess && !failed ? (
          <>
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-primary" />
            <p className="font-medium">{t('auth.confirmEmailChange.confirming')}</p>
          </>
        ) : (
          <>
            <div className={`mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl ${confirm.isSuccess ? 'bg-success/12 text-success' : 'bg-destructive/10 text-destructive'}`}>
              {confirm.isSuccess ? <CircleCheck className="size-6" /> : <Link2Off className="size-6" />}
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t(confirm.isSuccess ? 'auth.confirmEmailChange.successTitle' : 'auth.confirmEmailChange.failedTitle')}
            </h1>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              {confirm.isSuccess
                ? t('auth.confirmEmailChange.successBody')
                : token ? errorMessage(confirm.error) : t('auth.confirmEmailChange.incomplete')}
            </p>
            <Link to={confirm.isSuccess || !signedIn ? '/login' : '/'} className={buttonVariants({ size: 'lg', className: 'mt-8 w-full' })}>
              {t(confirm.isSuccess || !signedIn ? 'common.signIn' : 'common.goToWallet')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
