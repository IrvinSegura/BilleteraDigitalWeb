import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, CreditCard } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { api, type Schemas, unwrap } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import i18n, { type MessageKey } from '@/i18n'
import { formatDateTime, formatMinor } from '@/lib/format'
import { labelOf, operationStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError, ReasonAction } from './shared'

type Transaction = Schemas['ProviderTransactionResponse']
type Status = 'ALL' | 'PENDING' | 'POSTED' | 'UNMATCHED' | 'RESOLVED'

const LIMIT = 100

const statusOptions: { value: Status; labelKey: MessageKey }[] = [
  { value: 'ALL', labelKey: 'admin.payments.allStatuses' },
  { value: 'UNMATCHED', labelKey: 'admin.payments.unmatched' },
  { value: 'PENDING', labelKey: 'admin.payments.pending' },
  { value: 'POSTED', labelKey: 'admin.payments.posted' },
  { value: 'RESOLVED', labelKey: 'admin.payments.resolved' },
]

const transactionStatus: typeof operationStatus = {
  ...operationStatus,
  RESOLVED: { labelKey: 'labels.operationStatus.RESOLVED', tone: 'neutral' },
}

const providerName = (provider: string | undefined) => labelOf('admin.payments.providers', provider ?? '')

const notes: Record<string, MessageKey> = {
  'No collected payment for this charge': 'admin.payments.notes.noCollectedPayment',
  'Payment collected before the clearing account existed': 'admin.payments.notes.beforeClearing',
  'Refund the application did not ask for': 'admin.payments.notes.unrequestedRefund',
  'Payout that did not take money from the provider': 'admin.payments.notes.payoutTookNothing',
  'Payout reversal that did not return money to the provider': 'admin.payments.notes.reversalReturnedNothing',
}

// Why a movement needs a person, as the backend worded it; anything new is shown as it came
function noteText(note: string) {
  const notHandled = /^Not handled: (.+)$/.exec(note)
  if (notHandled) return i18n.t('admin.payments.notes.notHandled', { type: notHandled[1] })
  const currency = /^Currency (.+) is not supported$/.exec(note)
  if (currency) return i18n.t('admin.payments.notes.unsupportedCurrency', { currency: currency[1] })
  const key = notes[note]
  return key ? i18n.t(key) : note
}

function BalanceDifferences() {
  const { t } = useTranslation()
  const status = useQuery({
    queryKey: ['admin', 'payments', 'balance-differences'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/payments/provider-balance-differences')),
  })
  if (status.isPending) return <Skeleton className="h-24 rounded-xl" />
  if (status.isError) return <AdminError error={status.error} onRetry={() => status.refetch()} />
  const comparisons = status.data.comparisons ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.payments.balanceTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('admin.payments.balanceHint', { provider: providerName(status.data.provider) })}</p>
      </CardHeader>
      <CardContent>
        {!status.data.holdsFunds ? (
          <p className="text-sm text-muted-foreground">{t('admin.payments.noFunds')}</p>
        ) : comparisons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.payments.noComparison')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((c) => (
              <div key={c.currency} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{c.currency}</p>
                  <p className={cn('text-xl font-semibold tabular', c.differenceMinor === 0 ? 'text-success' : 'text-destructive')}>
                    {formatMinor(c.differenceMinor, c.currency)}
                  </p>
                </div>
                <dl className="space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('admin.payments.provider')}</dt>
                    <dd className="tabular">{formatMinor(c.providerBalanceMinor, c.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('admin.payments.ledger')}</dt>
                    <dd className="tabular">{formatMinor(c.recordedBalanceMinor, c.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('admin.payments.compared')}</dt>
                    <dd>{formatDateTime(c.comparedAt)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ResolveAction({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return (
    <ReasonAction trigger={<><CheckCheck /> {t('admin.payments.resolve')}</>} title={t('admin.payments.resolveTitle')}
      description={t('admin.payments.resolveHint')}
      confirmLabel={t('admin.payments.resolveConfirm')}
      onConfirm={async (reason) => {
        await unwrap(api.POST('/api/v1/admin/payments/provider-transactions/{provider}/{transactionId}/resolve', {
          params: { path: { provider: transaction.provider ?? '', transactionId: transaction.id ?? '' } },
          body: { reason },
        }))
        await queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'transactions'] })
      }} />
  )
}

export function AdminPaymentsPage() {
  const { t } = useTranslation()
  // The console's home links straight to what needs a person
  const [params] = useSearchParams()
  const [status, setStatus] = useState<Status>(params.get('status') === 'UNMATCHED' ? 'UNMATCHED' : 'ALL')
  const transactions = useQuery({
    queryKey: ['admin', 'payments', 'transactions', status],
    queryFn: () => unwrap(api.GET('/api/v1/admin/payments/provider-transactions', {
      params: { query: { status: status === 'ALL' ? undefined : status, limit: LIMIT } },
    })),
  })
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.payments.title')} description={t('admin.payments.description')} />
      <BalanceDifferences />
      <Card className="gap-0 pb-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <CardTitle>{t('admin.payments.movementsTitle')}</CardTitle>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)} className="w-44" aria-label={t('common.status')}
            options={statusOptions.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))} />
        </CardHeader>
        {transactions.isPending ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : transactions.isError ? (
          <AdminError error={transactions.error} onRetry={() => transactions.refetch()} />
        ) : transactions.data.length === 0 ? (
          <EmptyState icon={CreditCard} title={t('admin.payments.emptyTitle')}
            description={t(status === 'ALL' ? 'admin.payments.emptyHint' : 'admin.payments.emptyFiltered')} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">{t('admin.payments.movement')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.amount')}</TableHead>
                  <TableHead className="text-right">{t('common.fee')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('common.date')}</TableHead>
                  <TableHead className="pr-5"><span className="sr-only">{t('admin.action')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.data.map((m) => (
                  <TableRow key={`${m.provider}-${m.id}`}>
                    <TableCell className="pl-5 align-top">
                      <p className="font-medium">
                        {labelOf('admin.payments.types', m.type ?? '')}
                        {m.type === 'OTHER' && m.providerType && <span className="font-normal text-muted-foreground"> ({m.providerType})</span>}
                      </p>
                      <p className="max-w-56 truncate font-mono text-xs text-muted-foreground" title={m.id}>{providerName(m.provider)} · {m.id}</p>
                      {m.providerPaymentId && <p className="max-w-56 truncate font-mono text-xs text-muted-foreground" title={m.providerPaymentId}>{t('admin.payments.paymentId', { id: m.providerPaymentId })}</p>}
                      <p className="text-xs text-muted-foreground lg:hidden">{formatDateTime(m.createdAt)}</p>
                      {m.note && <p className={cn('mt-1 max-w-72 text-xs whitespace-normal', m.status === 'UNMATCHED' ? 'text-destructive' : 'text-muted-foreground')}>{noteText(m.note)}</p>}
                      {m.resolutionReason && (
                        <p className="mt-1 max-w-72 text-xs wrap-break-word whitespace-normal">
                          <span className="text-muted-foreground">{t('admin.payments.resolvedOn', { date: formatDateTime(m.resolvedAt) })}</span> {m.resolutionReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="align-top"><StatusBadge value={m.status} map={transactionStatus} /></TableCell>
                    <TableCell className="text-right align-top font-medium tabular">{formatMinor(m.amountMinor, m.currency?.toUpperCase())}</TableCell>
                    <TableCell className="text-right align-top text-muted-foreground tabular">{formatMinor(m.feeMinor, m.currency?.toUpperCase())}</TableCell>
                    <TableCell className="hidden align-top text-muted-foreground lg:table-cell">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell className="pr-5 text-right align-top">{m.status === 'UNMATCHED' && <ResolveAction transaction={m} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {transactions.data.length === LIMIT && (
              <p className="border-t px-5 py-3 text-xs text-muted-foreground">{t('admin.payments.latest', { limit: LIMIT })}</p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
