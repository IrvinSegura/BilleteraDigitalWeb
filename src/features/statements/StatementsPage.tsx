import { Eye, FileDown, FileText, Loader2, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { type Schemas } from '@/api/client'
import { useWallets, useWalletSummary } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { CurrencyIcon, currencyName } from '@/components/CurrencyIcon'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { currentMonth, today } from '@/features/wallets/MovementFilterBar'
import { formatCalendarDate, formatMoney } from '@/lib/format'
import { walletStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { PeriodPicker } from './PeriodPicker'
import { firstRecordDay, monthPeriod, type Period, periodFromParams, periodTitle, periodToParams } from './statement-data'
import { useStatementDownload } from './use-statement-download'

type WalletResponse = Schemas['WalletResponse']

/** One wallet's period at a glance, with its own statement to open or download. */
function WalletStatementCard({ wallet, period, download }: {
  wallet: WalletResponse
  period: Period
  download: ReturnType<typeof useStatementDownload>
}) {
  const { t } = useTranslation()
  const summary = useWalletSummary(wallet.id, period)
  const currency = wallet.balance?.currency ?? ''
  const downloading = download.isPending && !download.variables?.general && download.variables?.wallets[0]?.id === wallet.id
  const figures = [
    { label: t('wallets.statement.openingBalance'), value: summary.data?.openingBalance, tone: '' },
    { label: t('wallets.statement.moneyIn'), value: summary.data?.moneyIn, tone: 'text-emerald-700 dark:text-emerald-400', sign: '+' },
    { label: t('wallets.statement.moneyOut'), value: summary.data?.moneyOut, tone: 'text-red-700 dark:text-red-400', sign: '−' },
  ]
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <CurrencyIcon currency={currency} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{currencyName(currency)}</p>
            <p className="text-xs text-muted-foreground">{currency}</p>
          </div>
        </div>
        <StatusBadge value={wallet.status} map={walletStatus} />
      </div>
      <dl className="grid grid-cols-3 gap-3 px-5 py-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{figure.label}</dt>
            <dd className={cn('truncate text-sm font-medium tabular-nums', figure.tone)}>
              {summary.isPending ? <Skeleton className="mt-1 h-4 w-16" /> : `${figure.sign ?? ''}${formatMoney(figure.value)}`}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mx-5 mb-4 flex items-center justify-between rounded-xl bg-indigo-950 px-4 py-3 text-white">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200 uppercase">{t('wallets.statement.closingBalance')}</span>
        {summary.isPending ? <Skeleton className="h-6 w-24 bg-white/20" /> : (
          <span className="text-lg font-semibold tracking-tight tabular-nums">{formatMoney(summary.data?.closingBalance)}</span>
        )}
      </div>
      {summary.isError && <p className="px-5 pb-3 text-xs text-destructive">{t('statements.summaryError')}</p>}
      <div className="mt-auto flex gap-2 border-t bg-muted/30 px-5 py-3">
        <Link to={`/wallets/${wallet.id}/statement?${new URLSearchParams(periodToParams(period))}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'flex-1')}
          aria-label={t('statements.viewWallet', { currency })}>
          <Eye /> {t('statements.view')}
        </Link>
        <Button variant="outline" size="sm" className="flex-1" disabled={download.isPending}
          aria-label={t('statements.downloadWallet', { currency })}
          onClick={() => download.mutate({ period, general: false, wallets: [{ id: wallet.id!, currency }] })}>
          {downloading ? <Loader2 className="animate-spin" /> : <FileDown />} {t('statements.pdf.short')}
        </Button>
      </div>
    </Card>
  )
}

/**
 * Every statement of the user in one place, for one of the last three months, the three together, or days they pick:
 * one per wallet, or a general one that covers all of them. Nothing before their first wallet can be asked for.
 */
export function StatementsPage() {
  const { t } = useTranslation()
  const user = useUser()
  const [params, setParams] = useSearchParams()
  const wallets = useWallets()
  const download = useStatementDownload()
  const list = wallets.data ?? []
  const day = today()
  const first = firstRecordDay(list, user.createdAt)
  const period = periodFromParams(params, monthPeriod(currentMonth()), first, day)
  const downloadingAll = download.isPending && !!download.variables?.general
  const range = t('wallets.statement.period', { from: formatCalendarDate(period.from), to: formatCalendarDate(period.to) })

  return (
    <div className="space-y-6">
      <PageHeader title={t('statements.title')} description={t('statements.description')}
        actions={<PeriodPicker period={period} first={first} today={day}
          onChange={(next) => setParams(periodToParams(next), { replace: true })} />} />

      {/* The general statement, presented as the document it downloads */}
      <Card className="relative overflow-hidden p-0">
        <div aria-hidden className="absolute inset-x-0 top-0 flex h-1"><span className="w-2/3 bg-indigo-950 dark:bg-indigo-400" /><span className="flex-1 bg-indigo-500" /></div>
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-indigo-950 text-white dark:bg-indigo-500/20 dark:text-indigo-200">
              <FileText className="size-6" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{t('statements.pdf.generalKind')}</p>
              <p className="text-lg font-semibold">{periodTitle(period)}</p>
              <p className="text-sm text-muted-foreground">{range}</p>
              <p className="text-sm text-pretty text-muted-foreground">
                {t('statements.generalHint', { name: user.fullName, count: list.length })}
              </p>
            </div>
          </div>
          <Button size="lg" className="shrink-0" disabled={list.length === 0 || download.isPending}
            onClick={() => download.mutate({
              period, general: true,
              wallets: list.map((wallet) => ({ id: wallet.id!, currency: wallet.balance?.currency ?? '' })),
            })}>
            {downloadingAll ? <Loader2 className="animate-spin" /> : <FileDown />}
            {downloadingAll ? t('statements.generating') : t('statements.downloadAll')}
          </Button>
        </div>
      </Card>

      <section aria-labelledby="statements-by-wallet" className="space-y-3">
        <h2 id="statements-by-wallet" className="text-sm font-semibold text-muted-foreground">{t('statements.byWallet')}</h2>
        {wallets.isPending ? (
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
        ) : wallets.isError ? (
          <Card><ErrorState error={wallets.error} onRetry={() => wallets.refetch()} /></Card>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState icon={Wallet} title={t('statements.emptyTitle')} description={t('statements.emptyHint')}
              action={<Link to="/wallets" className={buttonVariants()}>{t('statements.goToWallets')}</Link>} />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((wallet) => <WalletStatementCard key={wallet.id} wallet={wallet} period={period} download={download} />)}
          </div>
        )}
      </section>
    </div>
  )
}
