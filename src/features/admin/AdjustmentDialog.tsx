import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HandCoins, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { AmountInput } from '@/components/AmountInput'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { parseAmount } from '@/features/money/shared'
import { formatMoney } from '@/lib/format'

type Direction = Schemas['AdjustmentRequest']['direction']

const DIRECTIONS: Direction[] = ['CREDIT', 'DEBIT']
// The API's limit for the reason the customer reads
export const MAX_ADJUSTMENT_REASON = 300

/** A credit adds and a debit takes, which matters more here than anywhere else. */
export function signedAmount(adjustment: Schemas['AdjustmentResponse']) {
  return `${adjustment.direction === 'DEBIT' ? '−' : '+'}${formatMoney(adjustment.amount)} ${adjustment.amount?.currency ?? ''}`.trim()
}

/** The API's refusal, in an administrator's words: its usual text speaks to the wallet's owner. */
export function adjustmentError(error: unknown, insufficient: string) {
  return hasCode(error, 'INSUFFICIENT_FUNDS') ? insufficient : errorMessage(error)
}

/**
 * A manual credit or debit to one of a customer's wallets. Within the administrator's limit it applies at once;
 * above it, it waits for a second administrator, which the API decides and the result reports.
 *
 * @param walletId the wallet to adjust, when it is already known; otherwise the customer's wallets are offered
 * @param ticketId the support ticket it settles, if any
 */
export function AdjustmentDialog({ userId, walletId, ticketId }: { userId: string; walletId?: string; ticketId?: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState(walletId ?? '')
  const [direction, setDirection] = useState<Direction>('CREDIT')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const wallets = useQuery({
    queryKey: ['admin', 'users', userId, 'wallets'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/users/{userId}/wallets', { params: { path: { userId } } })),
    enabled: open,
  })
  const options = wallets.data ?? []
  // A customer with one wallet has nothing to choose
  const walletToAdjust = picked || (options.length === 1 ? options[0]!.id! : '')
  const wallet = options.find((option) => option.id === walletToAdjust)
  const value = parseAmount(amount)

  function close() {
    setOpen(false)
    setPicked(walletId ?? '')
    setDirection('CREDIT')
    setAmount('')
    setReason('')
    adjust.reset()
  }

  const adjust = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/adjustments', {
      body: { walletId: walletToAdjust, direction, amount: value!, reason: reason.trim(), ticketId },
    })),
    onSuccess: async (result) => {
      toast.success(t(result.status === 'APPLIED' ? 'admin.adjustments.applied' : 'admin.adjustments.awaitingApproval'))
      close()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'adjustments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'wallets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'wallets'] }),
      ])
    },
  })

  const currency = wallet?.balance?.currency ?? ''
  const shown = value && currency ? `${formatMoney({ amount: amount as never, currency })} ${currency}` : null
  const ready = !!walletToAdjust && !!value && !!reason.trim()
  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) setOpen(true); else close() }}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}><HandCoins /> {t('admin.adjustments.create')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); if (ready) adjust.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('admin.adjustments.createTitle')}</DialogTitle>
            <DialogDescription>{t('admin.adjustments.createHint')}</DialogDescription>
          </DialogHeader>
          {wallets.isSuccess && options.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.adjustments.noWallets')}</p>
          ) : (
            <FormField label={t('admin.adjustments.wallet')}>
              {(field) => (
                <Select id={field.id} value={walletToAdjust} onValueChange={setPicked} placeholder={t('admin.adjustments.chooseWallet')}
                  options={options.map((option) => ({
                    value: option.id!,
                    label: (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="font-medium">{option.balance?.currency}</span>
                        <span className="text-muted-foreground tabular">{formatMoney(option.balance)}</span>
                      </span>
                    ),
                  }))} />
              )}
            </FormField>
          )}
          <SegmentedControl label={t('admin.adjustments.direction')} value={direction} onChange={setDirection}
            options={DIRECTIONS.map((next) => ({ value: next, label: t(`admin.adjustments.directions.${next}`) }))} />
          <FormField label={t('admin.adjustments.amount')}>
            {(field) => <AmountInput {...field} currency={currency || '—'} value={amount} onValueChange={setAmount} />}
          </FormField>
          <FormField label={t('admin.adjustments.reason')} hint={t('admin.adjustments.reasonHint')}>
            {(field) => (
              <textarea {...field} required maxLength={MAX_ADJUSTMENT_REASON} rows={3} value={reason} onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
            )}
          </FormField>
          <FormError message={adjust.isError ? adjustmentError(adjust.error, t('admin.adjustments.insufficient')) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            {/* The amount on the button: this moves a customer's money */}
            <Button type="submit" disabled={!ready || adjust.isPending}>
              {adjust.isPending && <Loader2 className="animate-spin" />}
              {shown
                ? t(direction === 'CREDIT' ? 'admin.adjustments.submitCredit' : 'admin.adjustments.submitDebit', { amount: shown })
                : t('admin.adjustments.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
