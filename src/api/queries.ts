import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useLiveConnected } from '@/lib/live-status'

import { api, unwrap } from './client'

/** Optional filters of a wallet's movements; dates are calendar days (`yyyy-MM-dd`), both included. */
export interface MovementFilters {
  from?: string
  to?: string
  /** Entry types; any of them matches */
  type?: string[]
  direction?: 'IN' | 'OUT'
  q?: string
}

/** Query keys in one place, so a mutation can invalidate exactly what it changed. */
export const keys = {
  wallets: ['wallets'] as const,
  wallet: (id: string) => ['wallets', id] as const,
  movements: (walletId: string, page: number, size: number, filters: MovementFilters = {}) =>
    ['wallets', walletId, 'movements', page, size, filters] as const,
  summary: (walletId: string, month?: string) => ['wallets', walletId, 'summary', month ?? 'current'] as const,
  balanceHistory: (walletId: string, days: number) => ['wallets', walletId, 'balance-history', days] as const,
  limits: (walletId: string) => ['wallets', walletId, 'limits'] as const,
  bankAccounts: ['bank-accounts'] as const,
  notifications: (unreadOnly: boolean, page: number) => ['notifications', 'list', unreadOnly, page] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  twoFactor: ['two-factor'] as const,
  recipients: ['transfers', 'recipients'] as const,
}

export function useWallets() {
  return useQuery({
    queryKey: keys.wallets,
    queryFn: () => unwrap(api.GET('/api/v1/wallets')),
    staleTime: 15_000,
  })
}

export function useWallet(walletId: string) {
  return useQuery({
    queryKey: keys.wallet(walletId),
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}', { params: { path: { walletId } } })),
  })
}

export function useMovements(walletId: string | undefined, page = 0, size = 20, filters: MovementFilters = {}) {
  return useQuery({
    queryKey: keys.movements(walletId ?? '', page, size, filters),
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/movements', {
      params: { path: { walletId: walletId! }, query: { page, size, ...filters } },
    })),
    enabled: !!walletId,
    placeholderData: keepPreviousData,
  })
}

/**
 * A calendar month of the wallet (`yyyy-MM`, the current one by default): its opening and closing balances and the
 * money in and out, summed by the API over every movement.
 */
export function useWalletSummary(walletId: string | undefined, month?: string) {
  return useQuery({
    queryKey: keys.summary(walletId ?? '', month),
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/summary', {
      params: { path: { walletId: walletId! }, query: { month } },
    })),
    enabled: !!walletId,
  })
}

/** Closing balance of each of the last {@link days} days, for the chart. */
export function useBalanceHistory(walletId: string | undefined, days = 30) {
  return useQuery({
    queryKey: keys.balanceHistory(walletId ?? '', days),
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/balance-history', {
      params: { path: { walletId: walletId! }, query: { days } },
    })),
    enabled: !!walletId,
    // Changing the period keeps the previous line on screen until the new one arrives
    placeholderData: keepPreviousData,
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: keys.bankAccounts,
    queryFn: () => unwrap(api.GET('/api/v1/bank-accounts')),
  })
}

export function useNotifications(unreadOnly: boolean, page: number, size = 20) {
  return useQuery({
    queryKey: keys.notifications(unreadOnly, page),
    queryFn: () => unwrap(api.GET('/api/v1/notifications', { params: { query: { unreadOnly, page, size } } })),
    placeholderData: keepPreviousData,
  })
}

/**
 * Polled while the tab is visible, so the bell lights up soon after money moves; rarely while the notification
 * stream is connected, since it refreshes the count as each notification arrives.
 */
export function useUnreadCount() {
  const live = useLiveConnected()
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => unwrap(api.GET('/api/v1/notifications/unread-count')),
    refetchInterval: live ? 300_000 : 30_000,
    refetchIntervalInBackground: false,
  })
}

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: keys.twoFactor,
    queryFn: () => unwrap(api.GET('/api/v1/users/me/two-factor')),
  })
}

/** The people the user paid most recently, to pick from instead of typing an email. */
export function useRecentRecipients() {
  return useQuery({
    queryKey: keys.recipients,
    queryFn: () => unwrap(api.GET('/api/v1/transfers/recipients', { params: { query: { limit: 6 } } })),
    staleTime: 60_000,
  })
}

/** How much more can leave the wallet today (transfers and withdrawals together) before its daily limit. */
export function useWalletLimits(walletId: string | undefined) {
  return useQuery({
    queryKey: keys.limits(walletId ?? ''),
    enabled: !!walletId,
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/limits', { params: { path: { walletId: walletId! } } })),
  })
}
