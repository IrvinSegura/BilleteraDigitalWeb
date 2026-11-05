import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, MailWarning, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'

import { ApiError, errorMessage, hasCode } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { CodeInput } from '@/components/CodeInput'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { AuthHeading } from '@/layouts/AuthLayout'
import { message } from '@/lib/validation'

const schema = z.object({
  email: z.email(message('validation.email')),
  password: z.string().min(1, message('validation.password')),
})

type Values = z.infer<typeof schema>

export function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  useRetranslateErrors(form)
  const [error, setError] = useState<unknown>(null)
  // Set once the API says this account has two-factor on: the second step asks for the code
  const [credentials, setCredentials] = useState<Values | null>(null)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  // Set when the password is right but the email isn't verified yet: the account can't sign in until it is
  const [unverified, setUnverified] = useState<Values | null>(null)
  const [resent, setResent] = useState(false)

  async function attempt(values: Values, twoFactorCode?: string) {
    setPending(true)
    setError(null)
    try {
      // GuestOnly sends the now signed-in user to the page they asked for
      await login(values.email, values.password, twoFactorCode)
    } catch (caught) {
      if (hasCode(caught, 'TWO_FACTOR_REQUIRED')) {
        setCredentials(values)
      } else if (hasCode(caught, 'EMAIL_NOT_VERIFIED')) {
        setUnverified(values)
      } else if (twoFactorCode && hasCode(caught, 'INVALID_CREDENTIALS')) {
        // The API answers a wrong code like a wrong password, so as not to say which one failed; the password
        // was just accepted, so on this step it means the code
        setCode('')
        setError(new ApiError(401, { code: 'INVALID_TWO_FACTOR_CODE' }))
      } else {
        setError(caught)
      }
    } finally {
      setPending(false)
    }
  }

  async function resendLink(values: Values) {
    setPending(true)
    setError(null)
    try {
      // Fails again with EMAIL_NOT_VERIFIED, having sent the link; signs in if the email was verified meanwhile
      await login(values.email, values.password, undefined, { resendVerification: true })
    } catch (caught) {
      if (hasCode(caught, 'EMAIL_NOT_VERIFIED')) {
        setResent(true)
      } else {
        setError(caught)
      }
    } finally {
      setPending(false)
    }
  }

  if (unverified) {
    return (
      <div>
        <AuthHeading
          icon={<div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground dark:text-warning"><MailWarning className="size-5" /></div>}
          title={t('auth.login.unverifiedTitle')}
          description={t('auth.login.unverifiedDescription', { email: unverified.email })}
        />
        <div className="grid gap-5">
          {resent ? (
            <p role="status" className="rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
              {t('auth.login.resent')}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('auth.login.notArrived')}</p>
          )}
          <FormError message={error ? errorMessage(error) : null} />
          {!resent && (
            <Button type="button" size="lg" disabled={pending} onClick={() => void resendLink(unverified)}>
              {pending && <Loader2 className="animate-spin" />} {t('auth.login.sendNewLink')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => { setUnverified(null); setResent(false); setError(null) }}>
            <ArrowLeft /> {t('common.back')}
          </Button>
        </div>
      </div>
    )
  }

  if (credentials) {
    return (
      <div>
        <AuthHeading
          icon={<div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><ShieldCheck className="size-5" /></div>}
          title={t('auth.login.twoFactorTitle')}
          description={t('auth.login.twoFactorDescription')}
        />
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void attempt(credentials, code)
          }}
        >
          <CodeInput autoFocus value={code} onValueChange={setCode} aria-label={t('common.verificationCode')} />
          <FormError message={error ? errorMessage(error) : null} />
          <Button type="submit" size="lg" disabled={pending || code.length < 6}>
            {pending && <Loader2 className="animate-spin" />} {t('auth.login.verifyAndEnter')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setCredentials(null); setCode(''); setError(null) }}>
            <ArrowLeft /> {t('auth.login.otherAccount')}
          </Button>
        </form>
      </div>
    )
  }

  const { errors } = form.formState
  return (
    <div>
      <AuthHeading title={t('auth.login.title')} description={t('auth.login.description')} />
      <form className="grid gap-5" noValidate onSubmit={form.handleSubmit((values) => attempt(values))}>
        <FormField label={t('common.emailField')} error={errors.email?.message}>
          {(field) => <Input {...field} type="email" autoComplete="email" placeholder={t('common.emailPlaceholder')} autoFocus {...form.register('email')} />}
        </FormField>
        <FormField
          label={t('common.password')}
          error={errors.password?.message}
          labelAction={<Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">{t('auth.login.forgot')}</Link>}
        >
          {(field) => <PasswordInput {...field} autoComplete="current-password" {...form.register('password')} />}
        </FormField>
        <FormError message={error ? errorMessage(error) : null} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {t('common.signIn')}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">{t('auth.login.createOne')}</Link>
      </p>
    </div>
  )
}
