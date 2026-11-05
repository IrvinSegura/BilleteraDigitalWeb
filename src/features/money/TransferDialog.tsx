import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { api, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { useRecentRecipients, useWallets } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { AmountInput } from '@/components/AmountInput'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SuggestInput } from '@/components/SuggestInput'
import { amountOf, formatDateTime, formatMoney, initials, newIdempotencyKey, shortId } from '@/lib/format'
import { hasMarkup, markupMessage } from '@/lib/plain-text'
import { cn } from '@/lib/utils'

import {
  DailyLimitNote, defaultWalletId, Outcome, parseAmount, SummaryList, useAfterMoneyMoved, useDailyLimit,
  VerifyEmailNotice, WalletSelect,
} from './shared'
import { MAX_CONCEPT as MAX_DESCRIPTION, type PaymentRequest } from './payment-link'
import { StepUpField, stepUpRequested, useStepUp } from './step-up'

const emailSchema = z.email()

// The people paid most recently, one tap away from the email field
function RecentRecipients({ selected, onPick }: { selected: string; onPick: (email: string) => void }) {
  const { t } = useTranslation()
  const { data } = useRecentRecipients()
  if (!data?.length) return null
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium text-muted-foreground">{t('money.transfer.recent')}</p>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {data.map((r) => (
          <button key={r.email} type="button" onClick={() => onPick(r.email!)} aria-pressed={selected === r.email}
            title={r.email}
            className={cn('flex w-18 shrink-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors',
              'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none',
              selected === r.email && 'bg-accent')}>
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
              {initials(r.displayName ?? '') || <UserRound className="size-4" />}
            </span>
            <span className="line-clamp-2 text-[0.7rem] leading-tight">{r.displayName}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Sends money to another user's wallet; a payment link's request comes in as `prefill`, to review and send. */
export function TransferDialog({ walletId: preferred, prefill, onClose }: {
  walletId?: string
  prefill?: PaymentRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const user = useUser()
  const { data: wallets } = useWallets()
  // A request in another currency is paid from the wallet in that currency, when there is one
  const requested = wallets?.find((w) => w.balance?.currency === prefill?.currency)?.id
  const [walletId, setWalletId] = useState(() => defaultWalletId(wallets, requested ?? preferred))
  const [recipient, setRecipient] = useState(prefill?.to ?? '')
  const [amount, setAmount] = useState(prefill?.amount ?? '')
  const [description, setDescription] = useState(prefill?.concept ?? '')
  // Who the email belongs to, as the API names them, shown on the review so a mistyped email is caught there
  const [recipientName, setRecipientName] = useState('')
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [touched, setTouched] = useState(false)
  // Made when the user reaches the review: retries of that same transfer reuse it, so it is sent once
  const [key, setKey] = useState('')
  const afterMoneyMoved = useAfterMoneyMoved()

  const wallet = wallets?.find((w) => w.id === walletId)
  const currency = wallet?.balance?.currency ?? 'MXN'
  const value = parseAmount(amount)
  const dailyLimit = useDailyLimit(walletId, value)
  const exceeds = (value !== null && value > amountOf(wallet?.balance)) || dailyLimit.over
  const recipientEmail = recipient.trim().toLowerCase()
  // Only among the people already paid: asking the API about any text would tell anyone who has an account
  const { data: recentRecipients } = useRecentRecipients()
  const recipientMatches = (recentRecipients ?? [])
    .filter((r) => r.email !== recipientEmail && recipientEmail
      && `${r.email} ${r.displayName ?? ''}`.toLowerCase().includes(recipientEmail))
    .map((r) => ({ value: r.email!, title: r.displayName ?? r.email!, detail: r.email! }))
  const lookup = useMutation({
    mutationFn: () => unwrap(api.GET('/api/v1/transfers/recipient', {
      params: { query: { email: recipientEmail, currency } },
    })),
    onSuccess: (found) => {
      setRecipientName(found.displayName ?? '')
      setKey(newIdempotencyKey())
      setStep('review')
    },
  })
  const notFound = hasCode(lookup.error, 'RECIPIENT_NOT_FOUND')
  const descriptionError = hasMarkup(description) ? markupMessage() : undefined
  const emailError = touched && !emailSchema.safeParse(recipientEmail).success
    ? t('validation.email')
    : recipientEmail === user.email.toLowerCase() ? t('money.transfer.selfTransfer')
      : notFound ? t('money.transfer.noWallet', { currency }) : undefined

  const stepUp = useStepUp(false)
  const transfer = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/transfers', {
      params: { header: { 'Idempotency-Key': key } },
      body: {
        sourceWalletId: walletId, recipientEmail, amount: value!, description: description.trim() || undefined,
        ...stepUp.fields,
      },
    })),
    onSuccess: afterMoneyMoved,
    // A refused attempt never claims the key, so the confirmed retry reuses it
    onError: (error) => stepUp.handle(error),
  })
  const shownError = transfer.isError && !stepUpRequested(transfer.error)
    && !hasCode(transfer.error, 'INVALID_TWO_FACTOR_CODE') && !hasCode(transfer.error, 'INCORRECT_PASSWORD')
    ? errorMessage(transfer.error) : null

  if (!user.emailVerified) {
    return (
      <>
        <DialogHeader><DialogTitle>{t('money.transfer.title')}</DialogTitle></DialogHeader>
        <VerifyEmailNotice email={user.email} />
      </>
    )
  }

  if (transfer.isSuccess) {
    const done = transfer.data
    return (
      <>
        <DialogHeader className="sr-only"><DialogTitle>{t('money.transfer.sent')}</DialogTitle></DialogHeader>
        <Outcome kind="success" title={t('money.transfer.sentTo', { name: done.recipientName ?? done.recipientEmail })} amount={done.amount}>
          <SummaryList rows={[
            { label: t('common.concept'), value: done.description || '—' },
            { label: t('common.date'), value: formatDateTime(done.createdAt) },
            { label: t('common.folio'), value: <span className="font-mono text-xs">{shortId(done.id)}</span> },
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
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); transfer.mutate() }}>
        <DialogHeader>
          <DialogTitle>{t('money.transfer.reviewTitle')}</DialogTitle>
          <DialogDescription>{t('money.transfer.reviewHint')}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-accent/60 px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">{t('money.transfer.youSend')}</p>
          <p className="text-3xl font-semibold tracking-tight tabular">{formatMoney({ amount, currency })}</p>
        </div>
        <SummaryList rows={[
          {
            label: t('common.to'),
            value: (
              <span className="grid text-right">
                {recipientName && <span>{recipientName}</span>}
                <span className={recipientName ? 'text-xs font-normal text-muted-foreground' : undefined}>{recipientEmail}</span>
              </span>
            ),
          },
          { label: t('common.from'), value: t('common.walletOf', { currency }) },
          { label: t('common.concept'), value: description.trim() || '—' },
          { label: t('common.balanceAfter'), value: formatMoney({ amount: String(amountOf(wallet?.balance) - value!), currency }) },
        ]} />
        <StepUpField stepUp={stepUp} error={transfer.error} />
        <FormError message={shownError} />
        <DialogFooter className="gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="lg" className="sm:flex-1" disabled={transfer.isPending}
            onClick={() => { transfer.reset(); setStep('form') }}>
            <ArrowLeft /> {t('common.edit')}
          </Button>
          <Button type="submit" size="lg" className="sm:flex-1" disabled={transfer.isPending || !stepUp.ready}>
            {transfer.isPending && <Loader2 className="animate-spin" />} {t(stepUp.method ? 'money.transfer.confirmAndSend' : 'money.transfer.sendNow')}
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setTouched(true)
        if (emailSchema.safeParse(recipientEmail).success && recipientEmail !== user.email.toLowerCase() && value && !exceeds && !descriptionError) {
          lookup.mutate()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(prefill ? 'money.transfer.payTitle' : 'money.transfer.title')}</DialogTitle>
        <DialogDescription>
          {t(prefill ? 'money.transfer.payDescription' : 'money.transfer.description')}
        </DialogDescription>
      </DialogHeader>
      {!prefill && <RecentRecipients selected={recipientEmail} onPick={(email) => { setRecipient(email); lookup.reset() }} />}
      <FormField label={t('money.transfer.recipient')} error={emailError}>
        {(field) => (
          <SuggestInput {...field} type="email" autoComplete="off" placeholder={t('money.transfer.recipientPlaceholder')} autoFocus={!prefill}
            value={recipient} onValueChange={(next) => { setRecipient(next); lookup.reset() }}
            suggestions={recipientMatches} onBlur={() => recipient && setTouched(true)} />
        )}
      </FormField>
      {(wallets?.length ?? 0) > 1 && (
        <FormField label={t('common.from')}>
          {(field) => <WalletSelect {...field} value={walletId} onValueChange={setWalletId} />}
        </FormField>
      )}
      <div className="grid gap-2">
        <AmountInput currency={currency} value={amount} onValueChange={setAmount} aria-label={t('common.amount')}
          aria-invalid={exceeds || undefined} />
        <p className={exceeds && !dailyLimit.over ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {t(exceeds && !dailyLimit.over ? 'money.overBalance' : 'common.available', { amount: formatMoney(wallet?.balance) })}
        </p>
        <DailyLimitNote {...dailyLimit} />
      </div>
      <FormField label={t('common.conceptOptional')} hint={`${description.length}/${MAX_DESCRIPTION}`} error={descriptionError}>
        {(field) => (
          <Input {...field} maxLength={MAX_DESCRIPTION} placeholder={t('money.transfer.conceptPlaceholder')} value={description}
            onChange={(e) => setDescription(e.target.value)} />
        )}
      </FormField>
      <FormError message={lookup.isError && !notFound ? errorMessage(lookup.error) : null} />
      <DialogFooter>
        <Button type="submit" size="lg" className="w-full" disabled={!walletId || value === null || exceeds || lookup.isPending}>
          {lookup.isPending && <Loader2 className="animate-spin" />} {t('common.continue')}
        </Button>
      </DialogFooter>
    </form>
  )
}
