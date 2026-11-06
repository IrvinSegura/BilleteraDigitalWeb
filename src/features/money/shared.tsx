import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Clock, Loader2, MailWarning, type LucideIcon, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { useWalletLimits, useWallets } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { amountOf, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

export type Wallet = Schemas['WalletResponse']

/** Refreshes everything a money movement changes: balances, movements, the notification bell and recent recipients. */
export function useAfterMoneyMoved() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['wallets'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    void queryClient.invalidateQueries({ queryKey: ['transfers'] })
  }
}

/** What the button that moves money says: what it does, or that it is doing it. */
export function ProcessingLabel({ pending, children }: { pending: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return pending ? <><Loader2 className="animate-spin" /> {t('common.processing')}</> : children
}

export function WalletSelect({ id, value, onValueChange, filter }: {
  id?: string
  value: string
  onValueChange: (id: string) => void
  filter?: (wallet: Wallet) => boolean
}) {
  const { t } = useTranslation()
  const { data } = useWallets()
  const wallets = (data ?? []).filter((w) => !filter || filter(w))
  return (
    <Select
      id={id}
      value={value}
      onValueChange={onValueChange}
      placeholder={t('money.chooseWallet')}
      options={wallets.map((w) => ({
        value: w.id!,
        disabled: w.status !== 'ACTIVE',
        label: (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="font-medium">{w.balance?.currency}</span>
            <span className="text-muted-foreground tabular">{formatMoney(w.balance)}</span>
          </span>
        ),
      }))}
    />
  )
}

/** Picks the wallet to preselect: the one asked for, else the first active one. */
export function defaultWalletId(wallets: Wallet[] | undefined, preferred?: string): string {
  if (preferred && wallets?.some((w) => w.id === preferred)) {
    return preferred
  }
  return wallets?.find((w) => w.status === 'ACTIVE')?.id ?? ''
}

export function QuickAmounts({ amounts, onPick }: { amounts: number[]; onPick: (amount: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onPick(String(amount))}
          className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground tabular"
        >
          ${amount.toLocaleString('es-MX')}
        </button>
      ))}
    </div>
  )
}

/** Review step: label/value rows before money moves. */
export function SummaryList({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="divide-y rounded-xl border bg-muted/30">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className={cn('min-w-0 truncate text-right', row.strong ? 'text-base font-semibold tabular' : 'font-medium')}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const outcomeStyles: Record<'success' | 'pending' | 'failed', { icon: LucideIcon; classes: string }> = {
  success: { icon: CircleCheck, classes: 'bg-success/12 text-success' },
  pending: { icon: Clock, classes: 'bg-warning/15 text-warning-foreground dark:text-warning' },
  failed: { icon: XCircle, classes: 'bg-destructive/10 text-destructive' },
}

/** The last step of a money dialog: what happened, how much, and the details. */
export function Outcome({ kind, title, amount, description, children }: {
  kind: 'success' | 'pending' | 'failed'
  title: string
  amount?: Schemas['MoneyResponse']
  description?: ReactNode
  children?: ReactNode
}) {
  const { icon: Icon, classes } = outcomeStyles[kind]
  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <div className={cn('flex size-14 items-center justify-center rounded-full animate-in zoom-in-50 duration-300', classes)}>
        <Icon className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{title}</p>
        {amount && <p className="text-3xl font-semibold tracking-tight tabular">{formatMoney(amount)}</p>}
      </div>
      {description && <p className="max-w-xs text-sm text-muted-foreground text-pretty">{description}</p>}
      {children && <div className="w-full text-left">{children}</div>}
    </div>
  )
}

/** Shown instead of a form that needs a verified email (sending and withdrawing money). */
export function VerifyEmailNotice({ email }: { email: string }) {
  const { t } = useTranslation()
  const resend = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/email-verification')),
    onSuccess: () => toast.success(t('common.linkResentTo', { email })),
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning-foreground dark:text-warning">
        <MailWarning className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{t('money.verifyEmail.title')}</p>
        <p className="text-sm text-muted-foreground text-pretty">
          <Trans
            i18nKey="money.verifyEmail.hint"
            values={{ email }}
            components={{ email: <span className="font-medium text-foreground" /> }}
          />
        </p>
      </div>
      <Button variant="outline" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
        {t(resend.isSuccess ? 'common.linkSent' : 'common.resendLink')}
      </Button>
    </div>
  )
}

/**
 * The daily limit on money leaving the wallet: `over` when the amount is more than what is left today. Until the
 * limits load nothing is blocked; the API checks again anyway.
 */
export function useDailyLimit(walletId: string | undefined, value: number | null) {
  const { data } = useWalletLimits(walletId)
  const remaining = data?.remainingToday
  return { remaining, limit: data?.dailyOutgoingLimit, over: !!remaining && value !== null && value > amountOf(remaining) }
}

export function DailyLimitNote({ remaining, limit, over }: ReturnType<typeof useDailyLimit>) {
  const { t } = useTranslation()
  if (!remaining || !limit) return null
  return (
    <p className={over ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
      {t(over ? 'money.dailyLimitOver' : 'money.dailyLimitLeft', { remaining: formatMoney(remaining), limit: formatMoney(limit) })}
    </p>
  )
}

/** Reads a positive amount from the amount field, or null. */
export function parseAmount(value: string): number | null {
  const amount = Number(value)
  return value && Number.isFinite(amount) && amount > 0 ? amount : null
}
