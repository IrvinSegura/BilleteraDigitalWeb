import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { HumanCheck, humanCheckEnabled } from '@/components/HumanCheck'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { AuthHeading } from '@/layouts/AuthLayout'
import { message } from '@/lib/validation'

const schema = z.object({ email: z.email(message('validation.email')) })

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  useRetranslateErrors(form)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // A CAPTCHA token works once: every attempt remounts the widget for a new one
  const [attempt, setAttempt] = useState(0)

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-success/12 text-success">
          <MailCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('auth.checkEmail')}</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          <Trans
            i18nKey="auth.forgot.sent"
            values={{ email: sentTo }}
            components={{ email: <span className="font-medium text-foreground" /> }}
          />
        </p>
        <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'mt-8 w-full' })}>
          <ArrowLeft /> {t('auth.backToSignIn')}
        </Link>
      </div>
    )
  }

  const { errors, isSubmitting } = form.formState
  return (
    <div>
      <AuthHeading title={t('auth.forgot.title')} description={t('auth.forgot.description')} />
      <form
        className="grid gap-5"
        noValidate
        onSubmit={form.handleSubmit(async ({ email }) => {
          setError(null)
          try {
            // The API answers the same whether or not the email has an account
            await unwrap(api.POST('/api/v1/auth/password-reset', { body: { email, captchaToken: captchaToken ?? undefined } }))
            setSentTo(email)
          } catch (caught) {
            setAttempt((n) => n + 1)
            setError(caught)
          }
        })}
      >
        <FormField label={t('common.emailField')} error={errors.email?.message}>
          {(field) => <Input {...field} type="email" autoComplete="email" placeholder={t('common.emailPlaceholder')} autoFocus {...form.register('email')} />}
        </FormField>
        <HumanCheck key={attempt} onToken={setCaptchaToken} />
        <FormError message={error ? errorMessage(error) : null} />
        <Button type="submit" size="lg" disabled={isSubmitting || (humanCheckEnabled && !captchaToken)}>
          {isSubmitting && <Loader2 className="animate-spin" />} {t('auth.forgot.submit')}
        </Button>
        <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
          <ArrowLeft /> {t('auth.backToSignIn')}
        </Link>
      </form>
    </div>
  )
}
