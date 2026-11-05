import { createContext, lazy, type ReactNode, Suspense, use, useCallback, useMemo, useState } from 'react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { DepositDialog } from './DepositDialog'
import type { PaymentRequest } from './payment-link'
import { TransferDialog } from './TransferDialog'
import { WithdrawDialog } from './WithdrawDialog'

// With the QR code library, loaded only when someone asks for money
const RequestDialog = lazy(() => import('./RequestDialog').then((module) => ({ default: module.RequestDialog })))

export type MoneyAction = 'deposit' | 'transfer' | 'withdraw' | 'request'

interface MoneyActions {
  /** `prefill` fills in a transfer, as a payment link asked */
  open: (action: MoneyAction, walletId?: string, prefill?: PaymentRequest) => void
}

const MoneyActionsContext = createContext<MoneyActions | null>(null)

export function useMoneyActions(): MoneyActions {
  const actions = use(MoneyActionsContext)
  if (!actions) {
    throw new Error('useMoneyActions must be used inside <MoneyActionsProvider>')
  }
  return actions
}

/** One dialog for depositing, sending and withdrawing, opened from any screen. */
export function MoneyActionsProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{
    action: MoneyAction
    walletId?: string
    prefill?: PaymentRequest
    id: number
  } | null>(null)
  const open = useCallback((action: MoneyAction, walletId?: string, prefill?: PaymentRequest) =>
    setCurrent({ action, walletId, prefill, id: Date.now() }), [])
  const close = useCallback(() => setCurrent(null), [])
  const value = useMemo(() => ({ open }), [open])

  const Content = current && {
    deposit: DepositDialog, transfer: TransferDialog, withdraw: WithdrawDialog, request: RequestDialog,
  }[current.action]
  return (
    <MoneyActionsContext value={value}>
      {children}
      <Dialog open={!!current} onOpenChange={(next) => !next && close()}>
        <DialogContent className={cn('max-h-[calc(100svh-2rem)] overflow-y-auto p-6 sm:max-w-md',
          current?.action === 'request' && 'md:max-w-3xl')}>
          {/* Keyed by each opening, so a new one starts with a fresh form and Idempotency-Key */}
          <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
            {Content && <Content key={current.id} walletId={current.walletId} prefill={current.prefill} onClose={close} />}
          </Suspense>
        </DialogContent>
      </Dialog>
    </MoneyActionsContext>
  )
}
