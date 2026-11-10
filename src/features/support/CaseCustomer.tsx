import { useQuery } from '@tanstack/react-query'
import { TriangleAlert, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { api, unwrap } from '@/api/client'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/format'
import { identityStatus, userStatus } from '@/lib/labels'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="grid justify-items-start gap-1 text-sm">{children}</dd>
    </div>
  )
}

/**
 * Where the customer's account stands, for the agent attending them: whether it is locked, its email and INE, and any
 * frozen wallet. No contact details or documents. The API only answers while the case is the agent's and open.
 */
export function CaseCustomer({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation()
  const standing = useQuery({
    queryKey: ['support', 'inbox', 'case', conversationId, 'customer'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations/{conversationId}/customer', { params: { path: { conversationId } } })),
  })

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserRound className="size-4" /> {t('support.inbox.customer.title')}</CardTitle>
        <CardDescription>{t('support.inbox.customer.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {standing.isPending ? <Skeleton className="h-24 rounded-lg" /> : standing.isError ? (
          <ErrorState error={standing.error} onRetry={() => standing.refetch()} />
        ) : (() => {
          const customer = standing.data
          // The API says NONE when they never sent it; the screens call that not started
          const identity = customer.identityStatus === 'NONE' ? 'NOT_STARTED' : customer.identityStatus
          const wallets = customer.wallets ?? []
          const blocksWithdrawals = customer.identityRequiredForWithdrawals && identity !== 'VERIFIED'
          return (
            <>
              {(blocksWithdrawals || !customer.emailVerified) && (
                <ul className="grid gap-2">
                  {blocksWithdrawals && (
                    <li className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" /> {t('support.inbox.customer.cannotWithdraw')}
                    </li>
                  )}
                  {!customer.emailVerified && (
                    <li className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" /> {t('support.inbox.customer.emailBlocks')}
                    </li>
                  )}
                </ul>
              )}
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Row label={t('support.inbox.customer.identity')}>
                  <StatusBadge value={identity} map={identityStatus} />
                  {customer.identitySubmittedAt && (
                    <span className="text-xs text-muted-foreground">{t('support.inbox.customer.submitted', { date: formatDateTime(customer.identitySubmittedAt) })}</span>
                  )}
                  {customer.identityRejectionReason && (
                    <span className="text-xs text-muted-foreground">{t('support.inbox.customer.rejected', { reason: customer.identityRejectionReason })}</span>
                  )}
                </Row>
                <Row label={t('support.inbox.customer.account')}>
                  <StatusBadge value={customer.status} map={userStatus} />
                  {customer.lockedUntil && (
                    <span className="text-xs text-destructive">{t('support.inbox.customer.lockedUntil', { date: formatDateTime(customer.lockedUntil) })}</span>
                  )}
                </Row>
                <Row label={t('support.inbox.customer.email')}>
                  {t(customer.emailVerified ? 'support.inbox.customer.emailVerified' : 'support.inbox.customer.emailPending')}
                </Row>
                <Row label={t('support.inbox.customer.wallets')}>
                  {wallets.length === 0 ? t('support.inbox.customer.noWallets') : wallets.map((wallet) => (
                    <span key={wallet.currency} className={wallet.frozen ? 'font-medium text-destructive' : undefined}>
                      {t(wallet.frozen ? 'support.inbox.customer.frozen' : 'support.inbox.customer.active', { currency: wallet.currency })}
                    </span>
                  ))}
                </Row>
                <Row label={t('support.inbox.customer.memberSince')}>{formatDate(customer.memberSince)}</Row>
              </dl>
            </>
          )
        })()}
      </CardContent>
    </Card>
  )
}
