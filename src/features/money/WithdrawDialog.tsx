import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Building2, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { api, unwrap } from '@/api/client'
import { hasCode, moneyErrorMessage, outcomeUnknown } from '@/api/errors'
import { useBankAccounts, useWallets } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { AmountInput } from '@/components/AmountInput'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button, buttonVariants } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { amountOf, formatDateTime, formatMoney, newIdempotencyKey } from '@/lib/format'
import { bankName } from '@/lib/labels'
import { cn } from '@/lib/utils'

import {
  DailyLimitNote, defaultWalletId, Outcome, parseAmount, ProcessingLabel, SummaryList, useAfterMoneyMoved, useDailyLimit,
  VerifyEmailNotice, WalletSelect,
} from './shared'
import { StepUpField, stepUpRequested, useStepUp } from './step-up'

export function WithdrawDialog({ walletId: preferred, onClose }: { walletId?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const { data: wallets } = useWallets()
  const bankAccounts = useBankAccounts()
  // Until the user picks one: the wallets may still be loading when the dialog opens
  const [pickedWallet, setWalletId] = useState('')
  const walletId = pickedWallet || defaultWalletId(wallets, preferred)
  const [chosenAccountId, setBankAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [key, setKey] = useState('')
  const afterMoneyMoved = useAfterMoneyMoved()

  const wallet = wallets?.find((w) => w.id === walletId)
  const currency = wallet?.balance?.currency ?? 'MXN'
  // MXN is paid by SPEI to one of the user's CLABEs; other currencies have no bank destination
  const needsBank = currency === 'MXN'
  const accounts = bankAccounts.data ?? []
  // Until the user picks one, the first account already past its cooling-off period, or the only one even while it
  // waits, so its notice says when it can receive withdrawals
  const bankAccountId = chosenAccountId
    || accounts.find((a) => !a.withdrawalsAvailableFrom || new Date(a.withdrawalsAvailableFrom) <= new Date())?.id
    || (accounts.length === 1 ? accounts[0]!.id : undefined)
    || ''
  const account = accounts.find((a) => a.id === bankAccountId)
  const coolingOff = account?.withdrawalsAvailableFrom && new Date(account.withdrawalsAvailableFrom) > new Date()
  const value = parseAmount(amount)
  const overBalance = value !== null && value > amountOf(wallet?.balance)
  const dailyLimit = useDailyLimit(walletId, value)
  const exceeds = overBalance || dailyLimit.over

  // Every withdrawal needs the owner's proof, so it is asked for on the review step right away
  const stepUp = useStepUp(true)
  const withdraw = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/wallets/{walletId}/withdrawals', {
      params: { path: { walletId }, header: { 'Idempotency-Key': key } },
      body: { amount: value!, bankAccountId: needsBank ? bankAccountId : undefined, ...stepUp.fields },
    })),
    onSuccess: afterMoneyMoved,
    onError: (error) => {
      stepUp.handle(error)
      // It may have gone through, and the balance on screen would be out of date
      if (outcomeUnknown(error)) afterMoneyMoved()
    },
  })
  const shownError = withdraw.isError && !stepUpRequested(withdraw.error)
    && !hasCode(withdraw.error, 'INVALID_TWO_FACTOR_CODE') && !hasCode(withdraw.error, 'INCORRECT_PASSWORD')
    ? moneyErrorMessage(withdraw.error) : null

  if (!user.emailVerified) {
    return (
      <>
        <DialogHeader><DialogTitle>{t('money.withdraw.title')}</DialogTitle></DialogHeader>
        <VerifyEmailNotice email={user.email} />
      </>
    )
  }

  if (withdraw.isSuccess) {
    const done = withdraw.data
    const paid = done.status === 'PAID'
    const failed = done.status === 'FAILED'
    return (
      <>
        <DialogHeader className="sr-only"><DialogTitle>{t('money.withdraw.resultTitle')}</DialogTitle></DialogHeader>
        <Outcome
          kind={paid ? 'success' : failed ? 'failed' : 'pending'}
          title={t(paid ? 'money.withdraw.paid' : failed ? 'money.withdraw.failed' : 'money.withdraw.pending')}
          amount={done.amount}
          description={t(failed ? 'money.withdraw.failedHint' : paid ? 'money.withdraw.paidHint' : 'money.withdraw.pendingHint')}
        >
          <SummaryList rows={[
            ...(account ? [{ label: t('money.withdraw.destination'), value: `${account.alias ?? bankName(account.bankCode)} •• ${account.clabeLastFour}` }] : []),
            { label: t('money.withdraw.walletBalance'), value: formatMoney(done.balance) },
            { label: t('common.date'), value: formatDateTime(done.createdAt) },
          ]} />
        </Outcome>
        <DialogFooter>
          <Button className="w-full" size="lg" onClick={onClose}>{t('common.done')}</Button>
        </DialogFooter>
      </>
    )
  }

  if (step === 'review') {
    return (
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); withdraw.mutate() }}>
        <DialogHeader>
          <DialogTitle>{t('money.withdraw.reviewTitle')}</DialogTitle>
          <DialogDescription>{t('money.withdraw.reviewHint')}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-accent/60 px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">{t('money.withdraw.youWithdraw')}</p>
          <p className="text-3xl font-semibold tracking-tight tabular">{formatMoney({ amount, currency })}</p>
        </div>
        <SummaryList rows={[
          ...(account ? [
            { label: t('money.withdraw.bank'), value: bankName(account.bankCode) },
            { label: t('money.withdraw.account'), value: `${account.holderName} •• ${account.clabeLastFour}` },
          ] : []),
          { label: t('money.withdraw.method'), value: needsBank ? 'SPEI' : t('money.withdraw.methodTransfer') },
          { label: t('common.fee'), value: t('common.noFee') },
        ]} />
        <StepUpField stepUp={stepUp} error={withdraw.error} />
        <FormError message={shownError} />
        <DialogFooter className="gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="lg" className="sm:flex-1" disabled={withdraw.isPending}
            onClick={() => { withdraw.reset(); setStep('form') }}>
            <ArrowLeft /> {t('common.edit')}
          </Button>
          <Button type="submit" size="lg" className="sm:flex-1" disabled={withdraw.isPending || !stepUp.ready}>
            <ProcessingLabel pending={withdraw.isPending}>{t('money.withdraw.confirm')}</ProcessingLabel>
          </Button>
        </DialogFooter>
      </form>
    )
  }

  const noAccounts = needsBank && bankAccounts.isSuccess && accounts.length === 0
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        setKey(newIdempotencyKey())
        setStep('review')
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('money.withdraw.title')}</DialogTitle>
        <DialogDescription>{t('money.withdraw.description')}</DialogDescription>
      </DialogHeader>
      {(wallets?.length ?? 0) > 1 && (
        <FormField label={t('common.from')}>
          {(field) => <WalletSelect {...field} value={walletId} onValueChange={setWalletId} />}
        </FormField>
      )}
      {noAccounts ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center">
          <Building2 className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('money.withdraw.noAccounts')}</p>
          <Link to="/bank-accounts" onClick={onClose} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('money.withdraw.addAccount')}
          </Link>
        </div>
      ) : needsBank && (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">{t('money.withdraw.destinationAccount')}</legend>
          {accounts.map((a) => {
            const waiting = a.withdrawalsAvailableFrom && new Date(a.withdrawalsAvailableFrom) > new Date()
            return (
              <label key={a.id} className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:bg-muted/50',
                'has-checked:border-primary has-checked:bg-accent/50 has-checked:ring-1 has-checked:ring-primary',
              )}>
                <input type="radio" name="bank-account" className="sr-only" checked={bankAccountId === a.id} onChange={() => setBankAccountId(a.id!)} />
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Building2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.alias ?? bankName(a.bankCode)} •• {a.clabeLastFour}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.holderName}</span>
                </span>
                {waiting && (
                  <span className="flex items-center gap-1 text-xs text-warning-foreground dark:text-warning">
                    <Clock className="size-3.5" /> {t('money.withdraw.waiting')}
                  </span>
                )}
              </label>
            )
          })}
        </fieldset>
      )}
      {coolingOff && (
        <p className="rounded-lg bg-warning/12 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
          {t('money.withdraw.coolingOff', { date: formatDateTime(account?.withdrawalsAvailableFrom) })}
        </p>
      )}
      <div className="grid gap-2">
        <AmountInput currency={currency} value={amount} onValueChange={setAmount} aria-label={t('common.amount')} aria-invalid={exceeds || undefined} />
        <div className="flex items-center justify-between text-xs">
          <span className={overBalance ? 'text-destructive' : 'text-muted-foreground'}>
            {t(overBalance ? 'money.withdraw.overBalance' : 'common.available', { amount: formatMoney(wallet?.balance) })}
          </span>
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setAmount(wallet?.balance?.amount ?? '')}>
            {t('money.withdraw.all')}
          </button>
        </div>
        <DailyLimitNote {...dailyLimit} />
      </div>
      <DialogFooter>
        <Button type="submit" size="lg" className="w-full"
          disabled={!walletId || value === null || exceeds || (needsBank && (!bankAccountId || !!coolingOff))}>
          {t('common.continue')}
        </Button>
      </DialogFooter>
    </form>
  )
}
