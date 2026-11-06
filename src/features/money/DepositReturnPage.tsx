import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { errorMessage, storedCodeMessage } from '@/api/errors'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'

import { forgetPendingDeposit, pendingDepositWallet } from './pending-deposits'
import { Outcome } from './shared'

// Past this the page stops waiting: the webhook may still come, and the notification tells the user then
const MAX_WAIT_MS = 120_000

/**
 * Where the provider's checkout sends the payer back (?payment=<deposit id>&result=success|cancel). The webhook
 * may land a moment later, so a pending deposit is polled until it settles.
 */
export function DepositReturnPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const depositId = params.get('payment') ?? ''
  const cancelled = params.get('result') === 'cancel'
  // Read once: a settled deposit is forgotten, and the page must not lose track of it on its next render
  const [walletId] = useState(() => (depositId ? pendingDepositWallet(depositId) : null))
  const [openedAt] = useState(() => Date.now())
  const queryClient = useQueryClient()

  const deposit = useQuery({
    queryKey: ['deposit', depositId],
    enabled: !!walletId,
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/deposits/{depositId}', { params: { path: { walletId: walletId!, depositId } } })),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' && !cancelled
      && query.state.dataUpdatedAt - openedAt < MAX_WAIT_MS ? 2000 : false),
  })
  const status = deposit.data?.status
  const stillWaiting = status === 'PENDING' && !cancelled && deposit.dataUpdatedAt - openedAt >= MAX_WAIT_MS

  useEffect(() => {
    if (status && status !== 'PENDING') {
      forgetPendingDeposit(depositId)
      void queryClient.invalidateQueries({ queryKey: ['wallets'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  }, [status, depositId, queryClient])

  let content: React.ReactNode
  if (!walletId) {
    content = <Outcome kind="pending" title={t('money.depositReturn.backTitle')} description={t('money.depositReturn.backHint')} />
  } else if (deposit.isError) {
    content = <Outcome kind="failed" title={t('money.depositReturn.lookupFailed')} description={errorMessage(deposit.error)} />
  } else if (stillWaiting) {
    content = <Outcome kind="pending" title={t('money.depositReturn.stillPending')} amount={deposit.data?.amount}
      description={t('money.depositReturn.stillPendingHint')} />
  } else if (!deposit.data || (status === 'PENDING' && !cancelled)) {
    content = (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">{t('money.depositReturn.confirming')}</p>
        <p className="text-sm text-muted-foreground">{t('money.depositReturn.confirmingHint')}</p>
      </div>
    )
  } else if (status === 'COMPLETED') {
    content = <Outcome kind="success" title={t('money.depositReturn.received')} amount={deposit.data.amount}
      description={<Trans
              i18nKey="money.newBalance"
              values={{ amount: formatMoney(deposit.data.balance) }}
              components={{ amount: <span className="font-medium text-foreground" /> }}
            />} />
  } else {
    content = <Outcome kind={status === 'PENDING' ? 'pending' : 'failed'}
      title={t(cancelled ? 'money.depositReturn.cancelled' : 'money.depositReturn.notCompleted')} amount={deposit.data.amount}
      description={storedCodeMessage(deposit.data.rejectionReason) ?? t('money.noCharge')} />
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="p-8">
        {content}
        <Link to={walletId ? `/wallets/${walletId}` : '/wallets'} className={buttonVariants({ size: 'lg', className: 'mt-2 w-full' })}>
          {t('common.goToWallet')}
        </Link>
      </Card>
    </div>
  )
}
