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
  WALLET_ADJUSTED: '/wallets',
  BANK_ACCOUNT_ADDED: '/bank-accounts',
  IDENTITY_VERIFIED: '/settings/identity',
  IDENTITY_REJECTED: '/settings/identity',
  PASSWORD_CHANGED: '/settings',
  TWO_FACTOR_ENABLED: '/settings',
  TWO_FACTOR_DISABLED: '/settings',
  ACCOUNT_LOCKED: '/settings',
  SUPPORT_AGENT_JOINED: '/support',
  SUPPORT_AGENT_REPLIED: '/support',
  SUPPORT_CASE_RESOLVED: '/support',
  SUPPORT_TICKET_RESOLVED: '/support',
  SUPPORT_ESCALATION_RESOLVED: '/support/escalated',
}

function destinationOf(notification: Notification) {
  // An agent goes straight to the case, with everything said before they arrived
  return notification.type === 'SUPPORT_CASE_ASSIGNED' && notification.referenceId
    ? `/support/inbox/${notification.referenceId}`
    : destinations[notification.type ?? '']
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

  const remove = useMutation({
    mutationFn: (notificationId: string) => unwrap(api.DELETE('/api/v1/notifications/{notificationId}', {
      params: { path: { notificationId } },
    })),
    onSuccess: refresh,
  })

  // Unread ones stay: they are what the user hasn't seen yet
  const removeRead = useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/v1/notifications/read')),
    onSuccess: refresh,
  })

  /** Marks it read and goes where it points, if anywhere. */
  function open(notification: Notification) {
    if (!notification.read) {
      markRead.mutate(notification.id!)
    }
    const to = destinationOf(notification)
    if (to) {
      void navigate(to)
    }
  }

  return { open, markAllRead, remove, removeRead }
}
