import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { keys, useTwoFactorStatus } from '@/api/queries'
import { useAuth, useUser } from '@/auth/auth-context'
import { CodeInput } from '@/components/CodeInput'
import { CopyButton } from '@/components/CopyButton'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { QrImage } from '@/components/QrImage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import i18n from '@/i18n'

function downloadCodes(codes: string[]) {
  const text = `${i18n.t('settings.twoFactor.codesFileTitle')}\n\n${i18n.t('settings.twoFactor.codesFileHint')}\n\n${codes.join('\n')}\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: i18n.t('settings.twoFactor.codesFileName') })
  link.click()
  URL.revokeObjectURL(url)
}

/** Password → scan the QR → confirm a code → save the recovery codes (shown only this once). */
function EnableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { refreshUser, logout } = useAuth()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')

  const begin = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/two-factor', { body: { currentPassword: password } })),
  })
  const confirm = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/two-factor/confirm', { body: { code } })),
    onSuccess: () => {
      void refreshUser()
      void queryClient.invalidateQueries({ queryKey: keys.twoFactor })
    },
  })
  const codes = confirm.data?.recoveryCodes

  // Turning two-factor on revokes every session, and this session's access token was issued without the
  // two-factor claim the admin console needs: signing in again with a code gets a session that has it
  function finish() {
    onOpenChange(false)
    toast.success(t('settings.twoFactor.enabledToast'))
    void logout()
  }

  function close(next: boolean) {
    // The recovery codes can't be shown again: leaving that step asks to save them first
    if (!next && codes) {
      if (window.confirm(t('settings.twoFactor.confirmLeave'))) {
        finish()
      }
      return
    }
    onOpenChange(next)
    if (!next) {
      setPassword('')
      setCode('')
      begin.reset()
      confirm.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-6 sm:max-w-md">
        {codes ? (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{t('settings.twoFactor.saveTitle')}</DialogTitle>
              <DialogDescription>
                {t('settings.twoFactor.saveDescription')}
              </DialogDescription>
            </DialogHeader>
            <ul className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-4 font-mono text-sm">
              {codes.map((c) => <li key={c} className="text-center tracking-wider">{c}</li>)}
            </ul>
            <DialogFooter className="gap-2 sm:flex-row">
              <Button variant="outline" className="sm:flex-1" onClick={() => downloadCodes(codes)}><Download /> {t('settings.twoFactor.download')}</Button>
              <Button className="sm:flex-1" onClick={finish}>{t('settings.twoFactor.saved')}</Button>
            </DialogFooter>
          </div>
        ) : begin.data ? (
          <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); confirm.mutate() }}>
            <DialogHeader>
              <DialogTitle>{t('settings.twoFactor.scanTitle')}</DialogTitle>
              <DialogDescription>{t('settings.twoFactor.scanDescription')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3">
              <QrImage value={begin.data.otpauthUri!} alt={t('settings.twoFactor.qrAlt')} />
              <div className="flex w-full items-center gap-2 rounded-lg border px-3 py-1.5">
                <span className="text-xs text-muted-foreground">{t('settings.twoFactor.manualKey')}</span>
                <code className="flex-1 truncate text-right font-mono text-xs">{begin.data.secret}</code>
                <CopyButton value={begin.data.secret!} label={t('settings.twoFactor.copyKey')} />
              </div>
            </div>
            <FormField label={t('settings.twoFactor.appCode')}>
              {(field) => <CodeInput {...field} autoFocus value={code} onValueChange={setCode} />}
            </FormField>
            <FormError message={confirm.isError ? errorMessage(confirm.error) : null} />
            <DialogFooter>
              <Button type="submit" size="lg" className="w-full" disabled={code.length < 6 || confirm.isPending}>
                {confirm.isPending && <Loader2 className="animate-spin" />} {t('settings.twoFactor.enable')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); begin.mutate() }}>
            <DialogHeader>
              <DialogTitle>{t('settings.twoFactor.enableTitle')}</DialogTitle>
              <DialogDescription>{t('settings.twoFactor.enableDescription')}</DialogDescription>
            </DialogHeader>
            <FormField label={t('common.currentPassword')}>
              {(field) => <PasswordInput {...field} autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            </FormField>
            <FormError message={begin.isError ? errorMessage(begin.error) : null} />
            <DialogFooter>
              <Button type="submit" size="lg" className="w-full" disabled={!password || begin.isPending}>
                {begin.isPending && <Loader2 className="animate-spin" />} {t('common.continue')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DisableDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const disable = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/two-factor/disable', { body: { currentPassword: password, code } })),
    onSuccess: () => {
      void refreshUser()
      void queryClient.invalidateQueries({ queryKey: keys.twoFactor })
      toast.success(t('settings.twoFactor.disabledToast'))
      onOpenChange(false)
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setPassword(''); setCode(''); disable.reset() } }}>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); disable.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('settings.twoFactor.disableTitle')}</DialogTitle>
            <DialogDescription>{t('settings.twoFactor.disableDescription')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('common.currentPassword')}>
            {(field) => <PasswordInput {...field} autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </FormField>
          <FormField label={t('settings.twoFactor.appOrRecoveryCode')}>
            {(field) => <CodeInput {...field} value={code} onValueChange={setCode} />}
          </FormField>
          <FormError message={disable.isError ? errorMessage(disable.error) : null} />
          <DialogFooter>
            <Button type="submit" variant="destructive" size="lg" className="w-full" disabled={!password || code.length < 6 || disable.isPending}>
              {disable.isPending && <Loader2 className="animate-spin" />} {t('settings.twoFactor.disable')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TwoFactorCard() {
  const { t } = useTranslation()
  const user = useUser()
  const status = useTwoFactorStatus()
  const [dialog, setDialog] = useState<'enable' | 'disable' | null>(null)
  const enabled = user.twoFactorEnabled
  const remaining = status.data?.unusedRecoveryCodes ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('settings.twoFactor.title')}
          {enabled
            ? <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">{t('settings.twoFactor.active')}</span>
            : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t('settings.twoFactor.inactive')}</span>}
        </CardTitle>
        <CardDescription>{t('settings.twoFactor.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className={enabled ? 'flex size-10 items-center justify-center rounded-xl bg-success/12 text-success' : 'flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground'}>
            {enabled ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
          </span>
          {enabled ? (
            <span className="text-muted-foreground">
              <KeyRound className="mr-1 inline size-3.5" />
              <Trans
                i18nKey="settings.twoFactor.codesLeft"
                count={remaining}
                components={{ count: <span className={remaining <= 2 ? 'font-medium text-destructive' : 'font-medium text-foreground'} /> }}
              />
            </span>
          ) : (
            <span className="text-muted-foreground">{t('settings.twoFactor.recommended')}</span>
          )}
        </div>
        {enabled
          ? <Button variant="outline" onClick={() => setDialog('disable')}>{t('settings.twoFactor.disable')}</Button>
          : <Button onClick={() => setDialog('enable')}><ShieldCheck /> {t('settings.twoFactor.enable')}</Button>}
      </CardContent>
      <EnableDialog open={dialog === 'enable'} onOpenChange={(o) => setDialog(o ? 'enable' : null)} />
      <DisableDialog open={dialog === 'disable'} onOpenChange={(o) => setDialog(o ? 'disable' : null)} />
    </Card>
  )
}
