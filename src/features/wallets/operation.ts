import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import i18n from '@/i18n'
import { operationStatus } from '@/lib/labels'

import type { Movement } from './MovementList'

export function useMovement(walletId: string, transactionId: string, enabled = true) {
  return useQuery({
    queryKey: ['wallets', walletId, 'movement', transactionId],
    enabled,
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/movements/{transactionId}', {
      params: { path: { walletId, transactionId } },
    })),
  })
}

// The operation behind a movement, for the details only it has (counterpart, concept, payout status)
export function useOperation(movement: Movement | undefined, walletId: string) {
  const id = movement?.operationId
  const type = movement?.type
  return useQuery({
    queryKey: ['operation', type, id],
    enabled: !!id,
    retry: false,
    queryFn: async () => {
      if (type === 'TRANSFER') {
        const t = await unwrap(api.GET('/api/v1/transfers/{transferId}', { params: { path: { transferId: id! } } }))
        return { kind: 'transfer' as const, transfer: t }
      }
      if (type === 'DEPOSIT') {
        const d = await unwrap(api.GET('/api/v1/wallets/{walletId}/deposits/{depositId}', { params: { path: { walletId, depositId: id! } } }))
        return { kind: 'deposit' as const, deposit: d }
      }
      if (type?.startsWith('WITHDRAWAL')) {
        const w = await unwrap(api.GET('/api/v1/wallets/{walletId}/withdrawals/{withdrawalId}', { params: { path: { walletId, withdrawalId: id! } } }))
        return { kind: 'withdrawal' as const, withdrawal: w }
      }
      return null
    },
  })
}

export type Operation = NonNullable<ReturnType<typeof useOperation>['data']>

/** A row of a movement's details; status rows carry the raw status so screens can show it as a badge. */
export interface DetailRow {
  label: string
  value: string
  status?: string
}

function person(name: string | undefined, email: string | undefined): string {
  return name ? `${name} (${email})` : email ?? '—'
}

function statusLabel(status: string | undefined): string {
  const style = operationStatus[status ?? '']
  return style ? i18n.t(style.labelKey) : status ?? '—'
}

/** The details the operation adds to its movement, in the order the detail and the receipt show them. */
export function operationRows(movement: Movement, operation: Operation | null | undefined): DetailRow[] {
  const rows: DetailRow[] = []
  if (operation?.kind === 'transfer') {
    const { transfer } = operation
    rows.push(movement.direction === 'IN'
      ? { label: i18n.t('wallets.movement.counterpartFrom'), value: person(transfer.senderName, transfer.senderEmail) }
      : { label: i18n.t('common.to'), value: person(transfer.recipientName, transfer.recipientEmail) })
    rows.push({ label: i18n.t('common.concept'), value: transfer.description || '—' })
  }
  if (operation?.kind === 'deposit') {
    const status = operation.deposit.status
    rows.push({ label: i18n.t('common.status'), value: statusLabel(status), status })
  }
  if (operation?.kind === 'withdrawal') {
    const { status, failureReason } = operation.withdrawal
    rows.push({ label: i18n.t('wallets.movement.withdrawalStatus'), value: statusLabel(status), status })
    if (failureReason) rows.push({ label: i18n.t('common.reason'), value: failureReason })
  }
  return rows
}
