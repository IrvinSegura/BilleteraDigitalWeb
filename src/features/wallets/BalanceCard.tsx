import { ArrowDownToLine, Eye, EyeOff, Landmark, QrCode, Send, Snowflake } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Schemas } from '@/api/client'
import { useCanWithdraw } from '@/api/queries'
import { useMoneyActions } from '@/features/money/MoneyActions'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const HIDE_KEY = 'wallet.hideBalance'

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

/** The brand card with the balance and the money actions; the balance can be hidden from onlookers. */
export function BalanceCard({ wallet, children }: { wallet: Schemas['WalletResponse']; children?: React.ReactNode }) {
  const { t } = useTranslation()
  const { open } = useMoneyActions()
  const [hidden, setHidden] = useState(readHidden)
  const frozen = wallet.status === 'FROZEN'
  const canWithdraw = useCanWithdraw()

  function toggle() {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1')
      } catch {
        // Only a convenience: it just won't be remembered
      }
      return !h
    })
  }

  const actions = [
    { label: t('wallets.actions.deposit'), icon: ArrowDownToLine, action: 'deposit' as const },
    { label: t('wallets.actions.send'), icon: Send, action: 'transfer' as const },
    { label: t('wallets.actions.withdraw'), icon: Landmark, action: 'withdraw' as const },
    { label: t('wallets.actions.request'), icon: QrCode, action: 'request' as const },
  ].filter((a) => a.action !== 'withdraw' || canWithdraw(wallet.balance?.currency))

  return (
    <div className="brand-surface relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-indigo-950/20 sm:p-8">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
      <div className="relative flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-white/75">
              {t('common.availableBalance')}
              <button type="button" onClick={toggle} aria-label={t(hidden ? 'wallets.showBalance' : 'wallets.hideBalance')}
                className="rounded-md p-1 transition-colors hover:bg-white/15">
                {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-4xl font-semibold tracking-tight tabular sm:text-5xl" aria-live="polite">
              {hidden ? '$ • • • • •' : formatMoney(wallet.balance)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold tracking-wide backdrop-blur">
              {wallet.balance?.currency}
            </span>
            {frozen && (
              <span className="flex items-center gap-1 rounded-lg bg-sky-400/25 px-2.5 py-1 text-xs font-medium">
                <Snowflake className="size-3.5" /> {t('wallets.frozen')}
              </span>
            )}
          </div>
        </div>
        {children}
        <div className={cn('grid gap-2 sm:flex sm:gap-3', actions.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {actions.map((a) => (
            <button
              key={a.action}
              type="button"
              disabled={frozen}
              onClick={() => open(a.action, wallet.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl bg-white/12 px-3 py-3 text-sm font-medium backdrop-blur transition-all sm:flex-row sm:px-5 sm:py-2.5',
                'hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none active:scale-[0.98]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                a.action === 'transfer' && 'bg-white text-indigo-700 hover:bg-white/90',
              )}
            >
              <a.icon className="size-[1.1rem]" />
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
