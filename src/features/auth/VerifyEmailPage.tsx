import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Link2Off, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { api, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { Logo } from '@/components/Logo'
import { buttonVariants } from '@/components/ui/button'

import { useLinkToken } from './token-link'

/** Opened from the emailed link, signed in or not; it posts the token (never a GET, so mail scanners can't). */
export function VerifyEmailPage() {
  const { t } = useTranslation()
  const token = useLinkToken()
  const { state, refreshUser } = useAuth()
  const signedIn = state.status === 'signed-in'
  const confirm = useMutation({
    mutationFn: (value: string) => unwrap(api.POST('/api/v1/auth/email-verification/confirm', { body: { token: value } })),
    onSuccess: () => signedIn && refreshUser(),
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

  const alreadyVerified = hasCode(confirm.error, 'EMAIL_ALREADY_VERIFIED')
  const success = confirm.isSuccess || alreadyVerified
  const failed = !token || (confirm.isError && !alreadyVerified)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-4">
      <Logo />
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        {!success && !failed ? (
          <>
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-primary" />
            <p className="font-medium">{t('auth.verify.verifying')}</p>
          </>
        ) : (
          <>
            <div className={`mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl ${success ? 'bg-success/12 text-success' : 'bg-destructive/10 text-destructive'}`}>
              {success ? <CircleCheck className="size-6" /> : <Link2Off className="size-6" />}
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t(success ? 'auth.verify.successTitle' : 'auth.verify.failedTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {success
                ? t(signedIn ? 'auth.verify.successSignedIn' : 'auth.verify.successSignedOut')
                : token
                  ? errorMessage(confirm.error)
                  : t('auth.verify.incomplete')}
            </p>
            <Link to={signedIn ? '/' : '/login'} className={buttonVariants({ size: 'lg', className: 'mt-8 w-full' })}>
              {t(signedIn ? 'common.goToWallet' : 'common.signIn')}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
