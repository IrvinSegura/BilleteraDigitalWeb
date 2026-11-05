import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { api, unwrap } from '@/api/client'

import type { Notification } from './NotificationItem'

// Where each kind of notice takes the user when opened
const destinations: Record<string, string> = {
  DEPOSIT_RECEIVED: '/wallets',
  DEPOSIT_REJECTED: '/wallets',
  WITHDRAWAL_SENT: '/wallets',
  WITHDRAWAL_FAILED: '/wallets',
  TRANSFER_SENT: '/wallets',
  TRANSFER_RECEIVED: '/wallets',
  WALLET_FROZEN: '/wallets',
  WALLET_UNFROZEN: '/wallets',
  BANK_ACCOUNT_ADDED: '/bank-accounts',
  PASSWORD_CHANGED: '/settings',
  TWO_FACTOR_ENABLED: '/settings',
  TWO_FACTOR_DISABLED: '/settings',
  ACCOUNT_LOCKED: '/settings',
}

export function useNotificationActions() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({
    mutationFn: (notificationId: string) => unwrap(api.POST('/api/v1/notifications/{notificationId}/read', {
      params: { path: { notificationId } },
    })),
    onSuccess: refresh,
  })

  const markAllRead = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/notifications/read-all')),
    onSuccess: refresh,
  })

  /** Marks it read and goes where it points, if anywhere. */
  function open(notification: Notification) {
    if (!notification.read) {
      markRead.mutate(notification.id!)
    }
    const to = destinations[notification.type ?? '']
    if (to) {
      void navigate(to)
    }
  }

  return { open, markAllRead }
}
