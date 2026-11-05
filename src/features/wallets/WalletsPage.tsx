import { ArrowRight, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useWallets } from '@/api/queries'
import { CurrencyIcon, currencyName } from '@/components/CurrencyIcon'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Card } from '@/components/ui/card'
import { formatDate, formatMoney } from '@/lib/format'
import { walletStatus } from '@/lib/labels'

import { OpenWalletDialog } from './OpenWalletDialog'


export function WalletsPage() {
  const { t } = useTranslation()
  const wallets = useWallets()
  return (
    <div className="space-y-6">
      <PageHeader title={t('wallets.title')} description={t('wallets.description')} actions={<OpenWalletDialog />} />
      {wallets.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /></div>
      ) : wallets.isError ? (
        <Card><ErrorState error={wallets.error} onRetry={() => wallets.refetch()} /></Card>
      ) : wallets.data.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title={t('wallets.emptyTitle')} description={t('wallets.emptyHint')}
            action={<OpenWalletDialog />} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {wallets.data.map((w) => (
            <Link key={w.id} to={`/wallets/${w.id}`}
              className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CurrencyIcon currency={w.balance?.currency} />
                  <div>
                    <p className="font-semibold">{w.balance?.currency}</p>
                    <p className="text-xs text-muted-foreground">{w.balance?.currency ? currencyName(w.balance.currency) : t('common.wallet')}</p>
                  </div>
                </div>
                <StatusBadge value={w.status} map={walletStatus} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('common.balance')}</p>
                <p className="text-3xl font-semibold tracking-tight tabular">{formatMoney(w.balance)}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('wallets.openedOn', { date: formatDate(w.createdAt) })}</span>
                <span className="flex items-center gap-1 font-medium text-primary">
                  {t('wallets.seeMovements')} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
