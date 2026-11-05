import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, Link2Off, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'

import { api, unwrap } from '@/api/client'
import { errorMessage, hasCode, isPasswordRejected } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PasswordInput, PasswordStrength } from '@/components/PasswordInput'
import { Button, buttonVariants } from '@/components/ui/button'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { AuthHeading } from '@/layouts/AuthLayout'
import { message } from '@/lib/validation'

import { useLinkToken } from './token-link'

const schema = z.object({
  password: z.string().min(12, message('validation.passwordMin', { min: 12 })).max(64, message('validation.maxChars', { max: 64 })),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], ...message('validation.passwordMismatch') })

function Outcome({ success }: { success: boolean }) {
  const { t } = useTranslation()
  const Icon = success ? CircleCheck : Link2Off
  return (
    <div className="text-center">
      <div className={`mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl ${success ? 'bg-success/12 text-success' : 'bg-destructive/10 text-destructive'}`}>
        <Icon className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{t(success ? 'auth.reset.successTitle' : 'auth.reset.invalidTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        {t(success ? 'auth.reset.successHint' : 'auth.reset.invalidHint')}
      </p>
      <Link to={success ? '/login' : '/forgot-password'} className={buttonVariants({ size: 'lg', className: 'mt-8 w-full' })}>
        {t(success ? 'common.signIn' : 'auth.reset.requestAnother')}
      </Link>
    </div>
  )
}

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const token = useLinkToken()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })
  useRetranslateErrors(form)
  const [outcome, setOutcome] = useState<'done' | 'invalid' | null>(token ? null : 'invalid')
  const [error, setError] = useState<unknown>(null)

  if (outcome) {
    return <Outcome success={outcome === 'done'} />
  }

  const { errors, isSubmitting } = form.formState
  return (
    <div>
      <AuthHeading title={t('auth.reset.title')} description={t('auth.reset.description')} />
      <form
        className="grid gap-5"
        noValidate
        onSubmit={form.handleSubmit(async ({ password }) => {
          setError(null)
          try {
            await unwrap(api.POST('/api/v1/auth/password-reset/confirm', { body: { token: token!, newPassword: password } }))
            setOutcome('done')
          } catch (caught) {
            if (hasCode(caught, 'INVALID_TOKEN')) {
              setOutcome('invalid')
            } else if (isPasswordRejected(caught)) {
              form.setError('password', { message: errorMessage(caught) })
            } else {
              setError(caught)
            }
          }
        })}
      >
        <FormField label={t('common.newPassword')} error={errors.password?.message}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" autoFocus {...form.register('password')} />}
        </FormField>
        <PasswordStrength password={form.watch('password')} />
        <FormField label={t('auth.reset.confirm')} error={errors.confirm?.message}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register('confirm')} />}
        </FormField>
        <FormError message={error ? errorMessage(error) : null} />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} {t('auth.reset.submit')}
        </Button>
      </form>
    </div>
  )
}
