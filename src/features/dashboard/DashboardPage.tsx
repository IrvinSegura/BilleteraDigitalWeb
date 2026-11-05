import { ArrowDownLeft, ArrowRight, ArrowUpRight, Building2, Check, MailCheck, ShieldCheck, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { Schemas } from '@/api/client'
import { useBankAccounts, useMovements, useWallets, useWalletSummary } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BalanceCard } from '@/features/wallets/BalanceCard'
import { BalanceHistoryCard } from '@/features/wallets/BalanceHistoryCard'
import { MovementList } from '@/features/wallets/MovementList'
import { OpenWalletDialog } from '@/features/wallets/OpenWalletDialog'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

function greetingKey() {
  const hour = new Date().getHours()
  return hour < 12 ? 'dashboard.morning' : hour < 19 ? 'dashboard.afternoon' : 'dashboard.evening'
}

function CurrencyTabs({ wallets, value, onChange }: {
  wallets: { id?: string; balance?: { currency?: string } }[]
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  if (wallets.length < 2) {
    return null
  }
  return (
    <div className="inline-flex rounded-xl bg-white/12 p-1 backdrop-blur" role="tablist" aria-label={t('common.wallet')}>
      {wallets.map((w) => (
        <button key={w.id} type="button" role="tab" aria-selected={value === w.id} onClick={() => onChange(w.id!)}
          className={cn('rounded-lg px-3 py-1 text-xs font-semibold transition-colors',
            value === w.id ? 'bg-white text-indigo-700' : 'text-white/80 hover:text-white')}>
          {w.balance?.currency}
        </button>
      ))}
    </div>
  )
}

function FlowStat({ label, money, pending, incoming }: {
  label: string
  money: Schemas['MoneyResponse'] | undefined
  pending: boolean
  incoming: boolean
}) {
  const Icon = incoming ? ArrowDownLeft : ArrowUpRight
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className={cn('flex size-10 items-center justify-center rounded-xl', incoming ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-[1.1rem]" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {pending ? <Skeleton className="mt-1 h-6 w-24" /> : (
          <p className="truncate text-lg font-semibold tracking-tight tabular">{formatMoney(money)}</p>
        )}
      </div>
    </div>
  )
}

function SetupChecklist() {
  const { t } = useTranslation()
  const user = useUser()
  const bankAccounts = useBankAccounts()
  const steps = [
    { done: true, label: t('dashboard.setup.createAccount'), icon: Check, to: '/settings' },
    { done: user.emailVerified, label: t('dashboard.setup.verifyEmail'), icon: MailCheck, to: '/settings' },
    { done: user.twoFactorEnabled, label: t('dashboard.setup.enableTwoFactor'), icon: ShieldCheck, to: '/settings#security' },
    { done: (bankAccounts.data?.length ?? 0) > 0, label: t('dashboard.setup.addBankAccount'), icon: Building2, to: '/bank-accounts' },
  ]
  const completed = steps.filter((s) => s.done).length
  if (completed === steps.length || bankAccounts.isPending) {
    return null
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.setup.title')}</CardTitle>
        <div className="flex items-center gap-3 pt-1">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular">{completed}/{steps.length}</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1">
        {steps.map((s) => (
          <Link key={s.label} to={s.to}
            className={cn('flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60', s.done && 'pointer-events-none')}>
            <span className={cn('flex size-7 items-center justify-center rounded-full',
              s.done ? 'bg-success/12 text-success' : 'border border-dashed text-muted-foreground')}>
              {s.done ? <Check className="size-3.5" /> : <s.icon className="size-3.5" />}
            </span>
            <span className={cn('flex-1', s.done && 'text-muted-foreground line-through')}>{s.label}</span>
            {!s.done && <ArrowRight className="size-4 text-muted-foreground" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function NoWallets() {
  const { t } = useTranslation()
  return (
    <Card className="overflow-hidden">
      <EmptyState
        icon={Wallet}
        title={t('dashboard.noWalletsTitle')}
        description={t('dashboard.noWalletsHint')}
        action={<OpenWalletDialog trigger={<button type="button" className={buttonVariants({ size: 'lg' })} />} />}
      />
    </Card>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const user = useUser()
  const wallets = useWallets()
  const [selectedId, setSelectedId] = useState('')
  const list = wallets.data ?? []
  const wallet = list.find((w) => w.id === selectedId) ?? list[0]
  const movements = useMovements(wallet?.id, 0, 6)
  const summary = useWalletSummary(wallet?.id)
  const items = movements.data?.items ?? []
  const currency = wallet?.balance?.currency ?? 'MXN'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{t('dashboard.greeting', { greeting: t(greetingKey()) })}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{user.fullName.split(' ')[0]}</h1>
      </div>

      {wallets.isPending ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : wallets.isError ? (
        <Card><ErrorState error={wallets.error} onRetry={() => wallets.refetch()} /></Card>
      ) : !wallet ? (
        <NoWallets />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
            <BalanceCard wallet={wallet}>
              <CurrencyTabs wallets={list} value={wallet.id!} onChange={setSelectedId} />
            </BalanceCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowStat label={t('dashboard.moneyIn')} money={summary.data?.moneyIn} pending={summary.isPending} incoming />
              <FlowStat label={t('dashboard.moneyOut')} money={summary.data?.moneyOut} pending={summary.isPending} incoming={false} />
            </div>
            <BalanceHistoryCard walletId={wallet.id!} currency={currency} title={t('dashboard.balanceHistory')} />
          </div>
          <div className="space-y-6">
            <SetupChecklist />
            <Card className="gap-0 pb-0">
              <CardHeader className="border-b pb-4">
                <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
                <CardAction className="self-center">
                  <Link to={`/wallets/${wallet.id}`} className="text-sm font-medium text-primary hover:underline">{t('dashboard.seeAll')}</Link>
                </CardAction>
              </CardHeader>
              {movements.isPending ? <ListSkeleton rows={4} /> : movements.isError ? (
                <ErrorState error={movements.error} onRetry={() => movements.refetch()} />
              ) : items.length === 0 ? (
                <EmptyState icon={ArrowDownLeft} title={t('dashboard.noMovementsTitle')} description={t('dashboard.noMovementsHint')} />
              ) : (
                <MovementList movements={items} walletId={wallet.id!} />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
