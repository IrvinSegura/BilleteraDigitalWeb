import { ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { Schemas } from '@/api/client'
import { CopyButton } from '@/components/CopyButton'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SummaryList } from '@/features/money/shared'
import { formatDateTime, formatMoney, formatRelative, formatShortDay } from '@/lib/format'
import { movementIcon, movementLabel, operationStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { operationRows, useOperation } from './operation'

export type Movement = Schemas['MovementResponse']

function MovementAmount({ movement, className }: { movement: Movement; className?: string }) {
  const incoming = movement.direction === 'IN'
  return (
    <span className={cn('font-semibold tabular whitespace-nowrap', incoming ? 'text-success' : 'text-foreground', className)}>
      {incoming ? '+' : '−'}{formatMoney(movement.amount)}
    </span>
  )
}

export function MovementRow({ movement, onOpen }: { movement: Movement; onOpen: (movement: Movement) => void }) {
  const { t } = useTranslation()
  const Icon = movementIcon(movement.type, movement.direction)
  const incoming = movement.direction === 'IN'
  return (
    <button
      type="button"
      onClick={() => onOpen(movement)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5"
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full',
        incoming ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-[1.1rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{movementLabel(movement.type, movement.direction)}</span>
        <span className="block truncate text-xs text-muted-foreground">{formatRelative(movement.createdAt)}</span>
      </span>
      <span className="text-right">
        <MovementAmount movement={movement} className="block text-sm" />
        <span className="block text-xs text-muted-foreground tabular">{t('common.balanceLabel', { amount: formatMoney(movement.balanceAfter) })}</span>
      </span>
    </button>
  )
}

/** Movements grouped under a day heading, newest first, as bank apps show them. */
export function MovementList({ movements, walletId }: { movements: Movement[]; walletId: string }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Movement | null>(null)
  const groups: { day: string; items: Movement[] }[] = []
  for (const movement of movements) {
    const day = movement.createdAt ? new Date(movement.createdAt).toDateString() : ''
    const last = groups.at(-1)
    if (last?.day === day) {
      last.items.push(movement)
    } else {
      groups.push({ day, items: [movement] })
    }
  }
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  return (
    <>
      {groups.map((group) => (
        <section key={group.day}>
          <h3 className="sticky top-16 z-10 border-y bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur sm:px-5 first:border-t-0">
            {group.day === today ? t('wallets.movement.today') : group.day === yesterday ? t('wallets.movement.yesterday') : formatShortDay(group.items[0]!.createdAt!)}
          </h3>
          <div className="divide-y">
            {group.items.map((m) => <MovementRow key={m.transactionId} movement={m} onOpen={setSelected} />)}
          </div>
        </section>
      ))}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="p-6 sm:max-w-md">
          {selected && <MovementDetail movement={selected} walletId={walletId} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function MovementDetail({ movement, walletId }: { movement: Movement; walletId: string }) {
  const { t } = useTranslation()
  const operation = useOperation(movement, walletId)
  const Icon = movementIcon(movement.type, movement.direction)
  const incoming = movement.direction === 'IN'
  const extra = operationRows(movement, operation.data).map((row) => ({
    label: row.label,
    value: row.status ? <StatusBadge value={row.status} map={operationStatus} /> : row.value,
  }))
  return (
    <div className="grid gap-5">
      <DialogHeader className="items-center text-center">
        <span className={cn('mb-2 flex size-12 items-center justify-center rounded-full',
          incoming ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>
          <Icon className="size-5" />
        </span>
        <DialogTitle className="font-normal text-muted-foreground">{movementLabel(movement.type, movement.direction)}</DialogTitle>
        <MovementAmount movement={movement} className="text-3xl tracking-tight" />
      </DialogHeader>
      <SummaryList rows={[
        { label: t('common.date'), value: formatDateTime(movement.createdAt) },
        ...extra,
        { label: t('common.balanceAfter'), value: formatMoney(movement.balanceAfter) },
      ]} />
      {operation.isPending && movement.operationId && <Skeleton className="h-10 w-full" />}
      {movement.operationId && (
        <div className="flex items-center justify-between rounded-xl border px-4 py-2">
          <span className="text-xs text-muted-foreground">{t('common.folio')}</span>
          <span className="flex items-center gap-1 font-mono text-xs">
            {movement.operationId}
            <CopyButton value={movement.operationId} label={t('wallets.movement.copyFolio')} />
          </span>
        </div>
      )}
      <Link to={`/wallets/${walletId}/receipts/${movement.transactionId}`} className={buttonVariants({ variant: 'outline' })}>
        <ReceiptText /> {t('wallets.movement.viewReceipt')}
      </Link>
    </div>
  )
}
