import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { BadgeCheck, Loader2, MailWarning, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { api, unwrap } from '@/api/client'
import { ApiError, errorMessage, isPasswordRejected } from '@/api/errors'
import { useAuth, useUser } from '@/auth/auth-context'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { PasswordInput, PasswordStrength } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { Avatar } from '@/layouts/UserMenu'
import { formatDate } from '@/lib/format'
import { labelOf } from '@/lib/labels'
import { hasMarkup } from '@/lib/plain-text'
import { message } from '@/lib/validation'

import { EmailPreferencesCard } from './EmailPreferencesCard'
import { SessionsCard } from './SessionsCard'
import { TwoFactorCard } from './TwoFactorCard'

const profileSchema = z.object({
  fullName: z.string().trim().min(1, message('validation.name')).max(100, message('validation.maxChars', { max: 100 }))
    .refine((name) => !hasMarkup(name), message('validation.markup')),
  // The API normalizes spaces, dashes and parentheses away; an empty phone removes it
  phone: z.string().trim().max(25, message('validation.maxChars', { max: 25 }))
    .refine((v) => v === '' || /^\+[1-9][\d\s().-]{7,}$/.test(v), message('validation.phone')),
})

function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const { updateProfile } = useAuth()
  const form = useForm({
    resolver: zodResolver(profileSchema),
    values: { fullName: user.fullName, phone: user.phone ?? '' },
  })
  useRetranslateErrors(form)
  const { errors, isSubmitting } = form.formState
  const submit = form.handleSubmit(async (values) => {
    try {
      await updateProfile(values)
      toast.success(t('settings.profile.updated'))
      onOpenChange(false)
    } catch (caught) {
      const field = caught instanceof ApiError && caught.code === 'INVALID_PROFILE'
        ? (caught.message.includes('phone') ? 'phone' : 'fullName') : 'root'
      form.setError(field, { message: errorMessage(caught) })
    }
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('settings.profile.editTitle')}</DialogTitle>
            <DialogDescription>{t('settings.profile.editDescription')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('common.fullName')} error={errors.fullName?.message}>
            {(field) => <Input {...field} autoComplete="name" maxLength={100} {...form.register('fullName')} />}
          </FormField>
          <FormField label={t('settings.profile.phoneOptional')} error={errors.phone?.message}>
            {(field) => (
              <Input {...field} type="tel" autoComplete="tel" placeholder="+52 55 1234 5678" maxLength={25}
                {...form.register('phone')} />
            )}
          </FormField>
          <FormError message={errors.root?.message} />
          <DialogFooter className="gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="sm:flex-1" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" className="sm:flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />} {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProfileCard() {
  const { t } = useTranslation()
  const user = useUser()
  const [editing, setEditing] = useState(false)
  const resend = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/email-verification')),
    onSuccess: () => toast.success(t('common.linkResentTo', { email: user.email })),
    onError: (error) => toast.error(errorMessage(error)),
  })
  const rows = [
    { label: t('settings.profile.name'), value: user.fullName },
    {
      label: t('common.email'),
      value: (
        <span className="flex flex-wrap items-center justify-end gap-2">
          {user.email}
          {user.emailVerified
            ? <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success"><BadgeCheck className="size-3.5" /> {t('settings.profile.verified')}</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning"><MailWarning className="size-3.5" /> {t('settings.profile.unverified')}</span>}
        </span>
      ),
    },
    { label: t('settings.profile.phone'), value: user.phone ?? <span className="font-normal text-muted-foreground">{t('settings.profile.noPhone')}</span> },
    { label: t('settings.profile.accountType'), value: labelOf('labels.roles', user.role) },
    { label: t('settings.profile.memberSince'), value: formatDate(user.createdAt) },
  ]
  return (
    <Card>
      <CardHeader className="flex items-center gap-4">
        <Avatar name={user.fullName} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg">{user.fullName}</CardTitle>
          <CardDescription className="truncate">{user.email}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> {t('common.edit')}
        </Button>
        <EditProfileDialog open={editing} onOpenChange={setEditing} />
      </CardHeader>
      <CardContent>
        <dl className="divide-y rounded-xl border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="min-w-0 text-right font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      {!user.emailVerified && (
        <CardFooter className="justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('settings.profile.noVerificationEmail')}</p>
          <Button variant="outline" size="sm" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
            {t(resend.isSuccess ? 'common.linkSent' : 'common.resendLink')}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, message('validation.currentPassword')),
  newPassword: z.string().min(12, message('validation.passwordMin', { min: 12 })).max(64, message('validation.maxChars', { max: 64 })),
  confirm: z.string(),
})
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], ...message('validation.passwordMismatch') })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], ...message('validation.passwordSame') })

function PasswordCard() {
  const { t } = useTranslation()
  const user = useUser()
  const { changePassword } = useAuth()
  const form = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  useRetranslateErrors(form)
  const { errors, isSubmitting } = form.formState
  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword(currentPassword, newPassword)
      form.reset()
      toast.success(t('settings.password.updated'))
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.password.title')}</CardTitle>
        <CardDescription>{t('settings.password.description')}</CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent className="grid gap-4">
          <FormField label={t('common.currentPassword')} error={errors.currentPassword?.message}>
            {(field) => <PasswordInput {...field} autoComplete="current-password" {...form.register('currentPassword')} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('common.newPassword')} error={errors.newPassword?.message}>
              {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register('newPassword')} />}
            </FormField>
            <FormField label={t('settings.password.confirm')} error={errors.confirm?.message}>
              {(field) => <PasswordInput {...field} autoComplete="new-password" {...form.register('confirm')} />}
            </FormField>
          </div>
          <PasswordStrength password={form.watch('newPassword')} personal={[user.email, user.fullName]} />
          <FormError message={errors.root?.message} />
        </CardContent>
        <CardFooter className="mt-4 justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />} {t('settings.password.submit')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { hash } = useLocation()
  // /settings#security (from the account menu) scrolls to the security section
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash])

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <ProfileCard />
          <EmailPreferencesCard />
        </div>
        <section id="security" className="scroll-mt-24 space-y-6">
          <TwoFactorCard />
          <SessionsCard />
          <PasswordCard />
        </section>
      </div>
    </div>
  )
}
