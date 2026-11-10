import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Mail, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

type StaffRole = 'SUPPORT' | 'ADMIN'

function StaffForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<StaffRole>('SUPPORT')
  const [reason, setReason] = useState('')
  const create = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/users', {
      body: { email: email.trim(), fullName: fullName.trim(), role, reason: reason.trim() },
    })),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(t('admin.users.staffCreatedToast', { email: created.email }))
      onDone()
      navigate(`/admin/users/${created.id}`)
    },
  })
  const ready = email.trim() && fullName.trim() && reason.trim()
  const submitLabel = t(role === 'ADMIN' ? 'admin.users.createAdminSubmit' : 'admin.users.createSupportSubmit')

  return (
    <form className="grid gap-5" noValidate onSubmit={(e) => { e.preventDefault(); if (ready) create.mutate() }}>
      <DialogHeader className="flex-row items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="size-5" />
        </span>
        <div className="grid min-w-0 gap-1 pr-6">
          <DialogTitle>{t('admin.users.createStaffTitle')}</DialogTitle>
          <DialogDescription>{t('admin.users.createStaffHint')}</DialogDescription>
        </div>
      </DialogHeader>
      <FormField label={t('admin.users.staffRole')} hint={t(role === 'ADMIN' ? 'admin.users.staffRoleAdminHint' : 'admin.users.staffRoleSupportHint')}>
        {(field) => (
          <Select {...field} aria-label={t('admin.users.staffRole')} value={role} onValueChange={(next) => setRole(next as StaffRole)} options={[
            { value: 'SUPPORT', label: t('labels.roles.SUPPORT') },
            { value: 'ADMIN', label: t('labels.roles.ADMIN') },
          ]} />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('common.fullName')}>
          {(field) => <Input {...field} required autoComplete="off" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />}
        </FormField>
        <FormField label={t('admin.users.staffEmail')}>
          {(field) => <Input {...field} type="email" required autoComplete="off" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />}
        </FormField>
      </div>
      <FormField label={t('common.reason')} hint={t('admin.reasonHint')}>
        {(field) => (
          <textarea {...field} required maxLength={200} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
        )}
      </FormField>
      <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-pretty text-muted-foreground">
        <Mail className="mt-0.5 size-3.5 shrink-0" /> {t('admin.users.createStaffPasswordNote')}
      </p>
      <FormError message={create.isError ? errorMessage(create.error) : null} />
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={!ready || create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />} {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Creates an administrator or support agent: sign-up only ever makes customers. Nobody here sees a password: the API
 * generates it and emails it to its owner, with their role and address.
 */
export function CreateStaffDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}><UserPlus /> {t('admin.users.createStaff')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-lg">
        <StaffForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
