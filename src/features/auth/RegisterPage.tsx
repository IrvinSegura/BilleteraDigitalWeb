import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'

import { api, unwrap } from '@/api/client'
import { ApiError, errorMessage, isPasswordRejected } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { HumanCheck, humanCheckEnabled } from '@/components/HumanCheck'
import { PasswordInput, PasswordStrength } from '@/components/PasswordInput'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { AuthHeading } from '@/layouts/AuthLayout'
import { hasMarkup } from '@/lib/plain-text'
import { message } from '@/lib/validation'

// Same bounds as the API (RegisterRequest and PasswordPolicy)
const schema = z.object({
  fullName: z.string().trim().min(2, message('validation.fullName')).max(100, message('validation.maxChars', { max: 100 }))
    .refine((name) => !hasMarkup(name), message('validation.markup')),
  email: z.email(message('validation.email')).max(254),
  password: z.string().min(12, message('validation.passwordMin', { min: 12 })).max(64, message('validation.maxChars', { max: 64 })),
})

type Values = z.infer<typeof schema>

export function RegisterPage() {
  const { t } = useTranslation()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fullName: '', email: '', password: '' } })
  useRetranslateErrors(form)
  const [error, setError] = useState<unknown>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // A CAPTCHA token works once: every attempt remounts the widget for a new one
  const [attempt, setAttempt] = useState(0)
  const password = form.watch('password')

  async function onSubmit(values: Values) {
    setError(null)
    try {
      // The API answers the same whether or not the email already has an account, so this page can't tell either:
      // the email says which
      await unwrap(api.POST('/api/v1/auth/register', { body: { ...values, captchaToken: captchaToken ?? undefined } }))
      setSentTo(values.email)
    } catch (caught) {
      setAttempt((n) => n + 1)
      if (caught instanceof ApiError) {
        // The API writes these in English, so they only mark which field to check
        for (const field of Object.keys(caught.fieldErrors)) {
          form.setError(field as keyof Values, { message: t('validation.invalidField') })
        }
        if (isPasswordRejected(caught)) {
          form.setError('password', { message: errorMessage(caught) })
          return
        }
      }
      setError(caught)
    }
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-success/12 text-success">
          <MailCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('auth.checkEmail')}</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          <Trans
            i18nKey="auth.register.sent"
            values={{ email: sentTo }}
            components={{ email: <span className="font-medium text-foreground" /> }}
          />
        </p>
        <p className="mt-4 text-xs text-muted-foreground text-pretty">
          {t('auth.register.notArrived')}
        </p>
        <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'mt-8 w-full' })}>
          <ArrowLeft /> {t('auth.register.goToSignIn')}
        </Link>
      </div>
    )
  }

  const { errors, isSubmitting } = form.formState
  return (
    <div>
      <AuthHeading title={t('auth.register.title')} description={t('auth.register.description')} />
      <form className="grid gap-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FormField label={t('common.fullName')} error={errors.fullName?.message}>
          {(field) => <Input {...field} autoComplete="name" placeholder={t('auth.register.namePlaceholder')} autoFocus {...form.register('fullName')} />}
        </FormField>
        <FormField label={t('common.emailField')} error={errors.email?.message}>
          {(field) => <Input {...field} type="email" autoComplete="email" placeholder={t('common.emailPlaceholder')} {...form.register('email')} />}
        </FormField>
        <FormField label={t('common.password')} error={errors.password?.message} hint={errors.password ? undefined : t('auth.register.passwordHint')}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register('password')} />}
        </FormField>
        <PasswordStrength password={password} personal={[form.watch('email'), form.watch('fullName')]} />
        <HumanCheck key={attempt} onToken={setCaptchaToken} />
        <FormError message={error ? errorMessage(error) : null} />
        <Button type="submit" size="lg" disabled={isSubmitting || (humanCheckEnabled && !captchaToken)}>
          {isSubmitting && <Loader2 className="animate-spin" />} {t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">{t('auth.register.signIn')}</Link>
      </p>
    </div>
  )
}
