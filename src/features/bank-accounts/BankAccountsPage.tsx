import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Clock, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { keys, useBankAccounts } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { CodeInput } from '@/components/CodeInput'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState, FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatClabe, isValidClabe } from '@/lib/clabe'
import { hasMarkup, markupMessage } from '@/lib/plain-text'
import { formatDate, formatDateTime } from '@/lib/format'
import { bankName } from '@/lib/labels'

type BankAccount = Schemas['BankAccountResponse']

function AddBankAccountDialog() {
  const { t } = useTranslation()
  const user = useUser()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [clabe, setClabe] = useState('')
  const [holder, setHolder] = useState(user.fullName)
  const [code, setCode] = useState('')
  const [touched, setTouched] = useState(false)
  const digits = clabe.replace(/\D/g, '')
  const clabeError = touched && digits.length > 0 && !isValidClabe(digits)
    ? t(digits.length < 18 ? 'bankAccounts.add.clabeLength' : 'bankAccounts.add.clabeCheckDigit')
    : undefined
  const bank = digits.length >= 3 ? bankName(digits.slice(0, 3)) : null

  const add = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/bank-accounts', {
      body: { clabe: digits, holderName: holder.trim(), twoFactorCode: user.twoFactorEnabled ? code : undefined },
    })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bankAccounts })
      toast.success(t('bankAccounts.add.added'))
      setOpen(false)
    },
  })

  function reset(next: boolean) {
    setOpen(next)
    if (!next) {
      setClabe('')
      setCode('')
      setTouched(false)
      add.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button />}>
        <Plus /> {t('bankAccounts.add.trigger')}
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (isValidClabe(digits) && holder.trim() && !hasMarkup(holder)) {
              add.mutate()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('bankAccounts.add.title')}</DialogTitle>
            <DialogDescription>{t('bankAccounts.add.description')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('bankAccounts.add.clabe')} error={clabeError ?? (add.isError && hasCode(add.error, 'INVALID_CLABE') ? errorMessage(add.error) : undefined)}
            hint={bank && !clabeError ? bank : t('bankAccounts.add.clabeHint')}>
            {(field) => (
              <Input {...field} inputMode="numeric" autoComplete="off" placeholder="012 180 00000000000 0" autoFocus
                className="font-mono tracking-wide" value={formatClabe(clabe)}
                onChange={(e) => setClabe(e.target.value)} onBlur={() => setTouched(true)} />
            )}
          </FormField>
          <FormField label={t('bankAccounts.add.holder')} error={hasMarkup(holder) ? markupMessage() : undefined}>
            {(field) => <Input {...field} maxLength={100} value={holder} onChange={(e) => setHolder(e.target.value)} />}
          </FormField>
          {user.twoFactorEnabled && (
            <FormField label={t('common.verificationCode')} hint={t('bankAccounts.add.codeHint')}>
              {(field) => <CodeInput {...field} value={code} onValueChange={setCode} />}
            </FormField>
          )}
          <div className="flex gap-3 rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" />
            {t('bankAccounts.add.notice')}
          </div>
          <FormError message={add.isError && !hasCode(add.error, 'INVALID_CLABE') ? errorMessage(add.error) : null} />
          <DialogFooter>
            <Button type="submit" size="lg" className="w-full" disabled={add.isPending || (user.twoFactorEnabled && code.length < 6)}>
              {add.isPending && <Loader2 className="animate-spin" />} {t('bankAccounts.add.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameButton({ account }: { account: BankAccount }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [alias, setAlias] = useState(account.alias ?? '')
  const rename = useMutation({
    mutationFn: () => unwrap(api.PATCH('/api/v1/bank-accounts/{bankAccountId}', {
      params: { path: { bankAccountId: account.id! } },
      body: { alias: alias.trim() },
    })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bankAccounts })
      toast.success(t('bankAccounts.rename.saved'))
      setOpen(false)
    },
  })
  const markup = hasMarkup(alias)
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setAlias(account.alias ?? ''); rename.reset() } }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('bankAccounts.rename.label', { lastFour: account.clabeLastFour })} />}>
        <Pencil />
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); if (!markup) rename.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('bankAccounts.rename.title')}</DialogTitle>
            <DialogDescription>{t('bankAccounts.rename.description')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('bankAccounts.rename.alias')} hint={t('bankAccounts.rename.hint')} error={markup ? markupMessage() : undefined}>
            {(field) => (
              <Input {...field} autoFocus maxLength={40} placeholder={t('bankAccounts.rename.placeholder')} value={alias}
                onChange={(e) => setAlias(e.target.value)} />
            )}
          </FormField>
          <FormError message={rename.isError ? errorMessage(rename.error) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={rename.isPending || markup}>
              {rename.isPending && <Loader2 className="animate-spin" />} {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveButton({ account }: { account: BankAccount }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/v1/bank-accounts/{bankAccountId}', { params: { path: { bankAccountId: account.id! } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bankAccounts })
      toast.success(t('bankAccounts.remove.removed'))
      setOpen(false)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('bankAccounts.remove.label', { lastFour: account.clabeLastFour })} />}>
        <Trash2 />
      </DialogTrigger>
      <DialogContent className="p-6">
        <DialogHeader>
          <DialogTitle>{t('bankAccounts.remove.title')}</DialogTitle>
          <DialogDescription>
            {t('bankAccounts.remove.description', { bank: bankName(account.bankCode), lastFour: account.clabeLastFour })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending && <Loader2 className="animate-spin" />} {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BankAccountsPage() {
  const { t } = useTranslation()
  const accounts = useBankAccounts()
  return (
    <div className="space-y-6">
      <PageHeader title={t('bankAccounts.title')} description={t('bankAccounts.description')} actions={<AddBankAccountDialog />} />
      <Card className="gap-0 py-0">
        {accounts.isPending ? (
          <div className="space-y-3 p-5"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : accounts.isError ? (
          <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />
        ) : accounts.data.length === 0 ? (
          <EmptyState icon={Building2} title={t('bankAccounts.emptyTitle')} description={t('bankAccounts.emptyHint')} />
        ) : (
          <ul className="divide-y">
            {accounts.data.map((a) => {
              const waiting = a.withdrawalsAvailableFrom && new Date(a.withdrawalsAvailableFrom) > new Date()
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Building2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* The owner's name for it comes first when there is one; the bank then goes with the details */}
                    <p className="truncate font-medium">{a.alias ?? bankName(a.bankCode)} <span className="font-mono text-sm text-muted-foreground">•••• {a.clabeLastFour}</span></p>
                    <p className="truncate text-sm text-muted-foreground">
                      {a.alias && `${bankName(a.bankCode)} · `}{t('bankAccounts.addedOn', { holder: a.holderName, date: formatDate(a.createdAt) })}
                    </p>
                  </div>
                  {/* On a phone its own line under the text, lined up past the icon: whether it can receive money matters there too */}
                  <div className="order-last basis-full pl-15 sm:order-none sm:basis-auto sm:pl-0">
                    {waiting ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-foreground dark:text-warning"
                        title={t('bankAccounts.availableFromTitle', { date: formatDateTime(a.withdrawalsAvailableFrom) })}>
                        <Clock className="size-3.5 shrink-0" /> {t('bankAccounts.availableOn', { date: formatDateTime(a.withdrawalsAvailableFrom) })}
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">{t('bankAccounts.ready')}</span>
                    )}
                  </div>
                  <div className="flex">
                    <RenameButton account={a} />
                    <RemoveButton account={a} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
