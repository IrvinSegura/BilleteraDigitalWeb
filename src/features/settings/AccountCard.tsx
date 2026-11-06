import { useMutation } from '@tanstack/react-query'
import { Download, Loader2, Mail, UserX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { useAuth, useUser } from '@/auth/auth-context'
import { CodeInput } from '@/components/CodeInput'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { saveFile } from '@/lib/download'

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/** What the account itself asks for besides the password: the second factor, when the user has one. */
function Credentials({ password, onPassword, code, onCode, passwordError }: {
  password: string
  onPassword: (value: string) => void
  code: string
  onCode: (value: string) => void
  passwordError?: string
}) {
  const { t } = useTranslation()
  const user = useUser()
  return (
    <>
      <FormField label={t('common.currentPassword')} error={passwordError}>
        {(field) => <PasswordInput {...field} autoComplete="current-password" value={password} onChange={(e) => onPassword(e.target.value)} />}
      </FormField>
      {user.twoFactorEnabled && (
        <FormField label={t('settings.twoFactor.appOrRecoveryCode')}>
          {(field) => <CodeInput {...field} value={code} onValueChange={onCode} />}
        </FormField>
      )}
    </>
  )
}

function ChangeEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const change = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/email', {
      body: { newEmail: newEmail.trim(), currentPassword: password, twoFactorCode: user.twoFactorEnabled ? code : undefined },
    })),
    onSuccess: () => {
      toast.success(t('settings.email.sent', { email: newEmail.trim() }))
      close(false)
    },
  })
  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setNewEmail('')
      setPassword('')
      setCode('')
      change.reset()
    }
  }
  const wrongPassword = hasCode(change.error, 'INCORRECT_PASSWORD')
  const ready = looksLikeEmail(newEmail) && password && (!user.twoFactorEnabled || code.length >= 6)
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); if (ready) change.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('settings.email.title')}</DialogTitle>
            <DialogDescription>{t('settings.email.description')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('settings.email.newEmail')}>
            {(field) => <Input {...field} type="email" autoFocus autoComplete="email" maxLength={254} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />}
          </FormField>
          <Credentials password={password} onPassword={setPassword} code={code} onCode={setCode}
            passwordError={wrongPassword ? errorMessage(change.error) : undefined} />
          <FormError message={change.isError && !wrongPassword ? errorMessage(change.error) : null} />
          <DialogFooter>
            <Button type="submit" size="lg" className="w-full" disabled={!ready || change.isPending}>
              {change.isPending && <Loader2 className="animate-spin" />} {t('settings.email.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CloseAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const { logout } = useAuth()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const word = t('settings.close.confirmWord')
  const closeAccount = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/close', {
      body: { currentPassword: password, twoFactorCode: user.twoFactorEnabled ? code : undefined },
    })),
    // Every session ended with it: this one is signed out here rather than on its next call
    onSuccess: async () => {
      toast.success(t('settings.close.closed'))
      await logout()
    },
  })
  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setPassword('')
      setCode('')
      setTyped('')
      closeAccount.reset()
    }
  }
  const wrongPassword = hasCode(closeAccount.error, 'INCORRECT_PASSWORD')
  const ready = typed.trim().toUpperCase() === word && password && (!user.twoFactorEnabled || code.length >= 6)
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); if (ready) closeAccount.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('settings.close.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('settings.close.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <Credentials password={password} onPassword={setPassword} code={code} onCode={setCode}
            passwordError={wrongPassword ? errorMessage(closeAccount.error) : undefined} />
          <FormField label={t('settings.close.confirmLabel', { word })}>
            {(field) => <Input {...field} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}
          </FormField>
          <FormError message={closeAccount.isError && !wrongPassword ? errorMessage(closeAccount.error) : null} />
          <DialogFooter>
            <Button type="submit" variant="destructive" size="lg" className="w-full" disabled={!ready || closeAccount.isPending}>
              {closeAccount.isPending && <Loader2 className="animate-spin" />} {t('settings.close.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Moving the account to another address, taking a copy of its data, and closing it. */
export function AccountCard() {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<'email' | 'close' | null>(null)
  const exportData = useMutation({
    mutationFn: () => unwrap(api.GET('/api/v1/users/me/export')),
    onSuccess: (data) => {
      const day = new Date().toISOString().slice(0, 10)
      saveFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `billetera-datos-${day}.json`)
      toast.success(t('settings.data.downloaded'))
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const rows = [
    {
      title: t('settings.email.rowTitle'), description: t('settings.email.rowDescription'),
      action: <Button variant="outline" size="sm" onClick={() => setDialog('email')}><Mail /> {t('settings.email.change')}</Button>,
    },
    {
      title: t('settings.data.title'), description: t('settings.data.description'),
      action: (
        <Button variant="outline" size="sm" disabled={exportData.isPending} onClick={() => exportData.mutate()}>
          {exportData.isPending ? <Loader2 className="animate-spin" /> : <Download />} {t('settings.data.download')}
        </Button>
      ),
    },
    {
      title: t('settings.close.title'), description: t('settings.close.description'),
      // Outlined: red text on the destructive variant's pale red falls short of the contrast the page needs
      action: (
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDialog('close')}>
          <UserX /> {t('settings.close.trigger')}
        </Button>
      ),
    },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.account.title')}</CardTitle>
        <CardDescription>{t('settings.account.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-xl border">
          {rows.map((row) => (
            <li key={row.title} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-xs text-pretty text-muted-foreground">{row.description}</p>
              </div>
              <div className="shrink-0">{row.action}</div>
            </li>
          ))}
        </ul>
      </CardContent>
      <ChangeEmailDialog open={dialog === 'email'} onOpenChange={(o) => setDialog(o ? 'email' : null)} />
      <CloseAccountDialog open={dialog === 'close'} onOpenChange={(o) => setDialog(o ? 'close' : null)} />
    </Card>
  )
}
