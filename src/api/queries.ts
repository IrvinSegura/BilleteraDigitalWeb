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
  identity: ['identity-verification'] as const,
  withdrawalCurrencies: ['withdrawals', 'currencies'] as const,
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
 * The wallet's opening and closing balances and the money in and out, summed by the API over every movement: for a
 * period of days (both included, at most a year), or for the current month without one.
 */
export function useWalletSummary(walletId: string | undefined, period?: { from: string; to: string }) {
  return useQuery({
    queryKey: keys.summary(walletId ?? '', period ? `${period.from}_${period.to}` : undefined),
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/summary', {
      params: { path: { walletId: walletId! }, query: { ...period } },
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

/** How many tickets wait for an administrator, for the menu; only asked when the user is one. */
export function useOpenTicketCount(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'tickets', 'open-count'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/support/tickets', { params: { query: { status: 'OPEN', size: 1 } } })),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

/** How many of the tickets the agent escalated still wait for the administrators, for the menu. */
export function useMyOpenTicketCount(enabled: boolean) {
  return useQuery({
    queryKey: ['support', 'escalated', 'open-count'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/tickets', { params: { query: { status: 'OPEN', size: 1 } } })),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

/** How many INE wait for review, for the menu and the administrators' home. */
export function usePendingIdentityCount(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'identity', 'pending-count'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/identity-verifications', { params: { query: { status: 'PENDING_REVIEW', size: 1 } } })),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

/** How many adjustments wait for a second administrator. */
export function usePendingAdjustmentCount(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'adjustments', 'pending-count'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/adjustments', { params: { query: { status: 'PENDING_APPROVAL', size: 1 } } })),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

/** The payment provider's movements nothing explains yet, and those still settling. */
export function useProviderTransactionCounts(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'payments', 'counts'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/payments/provider-transactions/counts')),
    enabled,
    refetchInterval: 60_000,
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

/**
 * Whether a wallet's currency can be withdrawn: the payout provider may pay only some (STP, only pesos). Until the
 * answer arrives, or if it can't be had, every currency counts as one, and the API still refuses the others.
 */
export function useCanWithdraw() {
  const { data } = useQuery({
    queryKey: keys.withdrawalCurrencies,
    queryFn: () => unwrap(api.GET('/api/v1/withdrawals/currencies')),
    // Set by the server's configuration, so it doesn't change while the app is open
    staleTime: Infinity,
  })
  const currencies = data?.currencies
  return (currency: string | undefined) => !currencies || (!!currency && currencies.includes(currency))
}

/** Where the customer's identity check stands: NOT_STARTED, PENDING_REVIEW, VERIFIED or REJECTED. */
export function useIdentityVerification(enabled = true) {
  return useQuery({
    queryKey: keys.identity,
    queryFn: () => unwrap(api.GET('/api/v1/users/me/identity-verification')),
    enabled,
  })
}
