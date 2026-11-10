import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ApiError, errorMessage, isPasswordRejected } from '@/api/errors'
import { useAuth, useUser } from '@/auth/auth-context'
import { FormField } from '@/components/FormField'
import { PasswordInput, PasswordStrength } from '@/components/PasswordInput'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { cn } from '@/lib/utils'
import { message } from '@/lib/validation'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, message('validation.currentPassword')),
  newPassword: z.string().min(12, message('validation.passwordMin', { min: 12 })).max(64, message('validation.maxChars', { max: 64 })),
  confirm: z.string(),
})
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], ...message('validation.passwordMismatch') })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], ...message('validation.passwordSame') })

/** Changing the password of the user who is signed in, wherever that's asked for. Each error goes to its own field. */
export function useChangePasswordForm(onChanged: () => void | Promise<void>) {
  const { changePassword } = useAuth()
  const form = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  useRetranslateErrors(form)
  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword(currentPassword, newPassword)
      form.reset()
      await onChanged()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INCORRECT_PASSWORD') {
        form.setError('currentPassword', { message: errorMessage(caught) })
      } else if (isPasswordRejected(caught)) {
        form.setError('newPassword', { message: errorMessage(caught) })
      } else {
        form.setError('root', { message: errorMessage(caught) })
      }
    }
  })
  return { form, submit }
}

/**
 * @param currentLabel what to call the current password, when "current" doesn't say which one it is
 * @param stacked one field per line, for a narrow column
 */
export function ChangePasswordFields({ form, currentLabel, stacked = false }: {
  form: ReturnType<typeof useChangePasswordForm>['form']
  currentLabel?: string
  stacked?: boolean
}) {
  const { t } = useTranslation()
  const user = useUser()
  const { errors } = form.formState
  return (
    <>
      <FormField label={currentLabel ?? t('common.currentPassword')} error={errors.currentPassword?.message}>
        {(field) => <PasswordInput {...field} autoComplete="current-password" {...form.register('currentPassword')} />}
      </FormField>
      <div className={cn('grid gap-4', !stacked && 'sm:grid-cols-2')}>
        <FormField label={t('common.newPassword')} error={errors.newPassword?.message}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register('newPassword')} />}
        </FormField>
        <FormField label={t('settings.password.confirm')} error={errors.confirm?.message}>
          {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register('confirm')} />}
        </FormField>
      </div>
      <PasswordStrength password={form.watch('newPassword')} personal={[user.email, user.fullName]} />
    </>
  )
}
