import { KeyRound, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { toast } from 'sonner'

import { useAuth, useUser } from '@/auth/auth-context'
import { homeOf } from '@/auth/roles'
import { FormError } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { ChangePasswordFields, useChangePasswordForm } from '@/features/settings/password-form'
import { AuthHeading } from '@/layouts/AuthLayout'

/**
 * Where an account that still has the password it was emailed stays until it replaces it: that password also sits in
 * an inbox. The API refuses everything else in the meantime; RequireAuth keeps the app here too.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation()
  const user = useUser()
  const { refreshUser, logout } = useAuth()
  const { form, submit } = useChangePasswordForm(async () => {
    await refreshUser()
    toast.success(t('auth.changePassword.done'))
  })
  const { errors, isSubmitting } = form.formState

  if (!user.mustChangePassword) {
    return <Navigate to={homeOf(user.role)} replace />
  }
  return (
    <>
      <AuthHeading title={t('auth.changePassword.title')} description={t('auth.changePassword.hint')} icon={(
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="size-6" />
        </span>
      )} />
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <ChangePasswordFields form={form} currentLabel={t('auth.changePassword.current')} stacked />
        <FormError message={errors.root?.message} />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} {t('auth.changePassword.submit')}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void logout()}>{t('common.signOut')}</Button>
      </form>
    </>
  )
}
