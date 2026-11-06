import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage, storedCodeMessage } from '@/api/errors'
import { useWallets } from '@/api/queries'
import { AmountInput } from '@/components/AmountInput'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney, newIdempotencyKey } from '@/lib/format'

import { isTrustedCheckoutUrl, UntrustedCheckoutError } from './checkout-url'
import { rememberPendingDeposit } from './pending-deposits'
import { defaultWalletId, Outcome, parseAmount, ProcessingLabel, QuickAmounts, SummaryList, useAfterMoneyMoved, WalletSelect } from './shared'

// The API's transfers.max-deposit; it enforces it, this only warns before sending
const MAX_DEPOSIT: Record<string, number> = { MXN: 100_000, USD: 5_000 }

export function DepositDialog({ walletId: preferred, onClose }: { walletId?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: wallets } = useWallets()
  // Until the user picks one: the wallets may still be loading when the dialog opens
  const [pickedWallet, setWalletId] = useState('')
  const walletId = pickedWallet || defaultWalletId(wallets, preferred)
  const [amount, setAmount] = useState('')
  // One key per deposit attempt: a retry after a timeout replays it instead of charging twice
  const [key] = useState(newIdempotencyKey)
  const afterMoneyMoved = useAfterMoneyMoved()
  const wallet = wallets?.find((w) => w.id === walletId)
  const currency = wallet?.balance?.currency ?? 'MXN'
  const max = MAX_DEPOSIT[currency]
  const value = parseAmount(amount)
  const tooLarge = value !== null && max !== undefined && value > max

  const deposit = useMutation({
    mutationFn: async () => {
      const result = await unwrap(api.POST('/api/v1/wallets/{walletId}/deposits', {
        params: { path: { walletId }, header: { 'Idempotency-Key': key } },
        body: { amount: value! },
      }))
      // The pending deposit expires on its own if the payer never reaches a checkout
      if (result.status === 'PENDING' && result.checkoutUrl && !isTrustedCheckoutUrl(result.checkoutUrl)) {
        throw new UntrustedCheckoutError()
      }
      return result
    },
    onSuccess: (result: Schemas['DepositResponse']) => {
      if (result.status === 'PENDING' && result.checkoutUrl) {
        // The payer leaves for the provider's checkout and comes back to /deposits/return
        rememberPendingDeposit(result.id!, walletId)
        window.location.assign(result.checkoutUrl)
        return
      }
      afterMoneyMoved()
    },
  })

  const result = deposit.data
  if (result && !(result.status === 'PENDING' && result.checkoutUrl)) {
    const completed = result.status === 'COMPLETED'
    return (
      <>
        <DialogHeader className="sr-only">
          <DialogTitle>{t('money.deposit.resultTitle')}</DialogTitle>
        </DialogHeader>
        <Outcome
          kind={completed ? 'success' : result.status === 'PENDING' ? 'pending' : 'failed'}
          title={t(completed ? 'money.deposit.completed' : result.status === 'PENDING' ? 'money.deposit.pending' : 'money.deposit.failed')}
          amount={result.amount}
          description={completed
            ? <Trans
              i18nKey="money.newBalance"
              values={{ amount: formatMoney(result.balance) }}
              components={{ amount: <span className="font-medium text-foreground" /> }}
            />
            : storedCodeMessage(result.rejectionReason) ?? t('money.deposit.failedHint')}
        />
        <DialogFooter>
          <Button className="w-full" size="lg" onClick={onClose}>{t('common.done')}</Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        deposit.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('money.deposit.title')}</DialogTitle>
        <DialogDescription>{t('money.deposit.description')}</DialogDescription>
      </DialogHeader>
      {(wallets?.length ?? 0) > 1 && (
        <FormField label={t('common.wallet')}>
          {(field) => <WalletSelect {...field} value={walletId} onValueChange={setWalletId} />}
        </FormField>
      )}
      <div className="grid gap-3">
        <AmountInput currency={currency} value={amount} onValueChange={setAmount} autoFocus aria-label={t('common.amount')}
          aria-invalid={tooLarge || undefined} />
        <QuickAmounts amounts={currency === 'USD' ? [20, 50, 100, 500] : [200, 500, 1000, 5000]} onPick={setAmount} />
        {max !== undefined && (
          <p className={tooLarge ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            {t('money.deposit.max', { amount: formatMoney({ amount: String(max), currency }) })}
          </p>
        )}
      </div>
      {value !== null && !tooLarge && (
        <SummaryList rows={[
          { label: t('money.deposit.youReceive'), value: formatMoney({ amount: amount, currency }), strong: true },
          { label: t('common.fee'), value: t('common.noFee') },
        ]} />
      )}
      <FormError message={!deposit.isError ? null
        : deposit.error instanceof UntrustedCheckoutError ? t('money.deposit.untrustedCheckout') : errorMessage(deposit.error)} />
      <DialogFooter>
        <Button type="submit" size="lg" className="w-full" disabled={!walletId || value === null || tooLarge || deposit.isPending}>
          <ProcessingLabel pending={deposit.isPending}>{t('money.deposit.submit')}</ProcessingLabel>
        </Button>
      </DialogFooter>
    </form>
  )
}
