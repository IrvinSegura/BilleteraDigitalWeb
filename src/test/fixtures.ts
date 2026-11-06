import type { Schemas } from '@/api/client'

// Type-only import: nothing from the API client runs, so fetch can still be stubbed before it loads

export const mxnWallet: Schemas['WalletResponse'] = {
  id: 'wallet-mxn',
  balance: { amount: '1000.00', currency: 'MXN' },
  status: 'ACTIVE',
  createdAt: '2026-01-15T12:00:00Z',
}

export const usdWallet: Schemas['WalletResponse'] = {
  id: 'wallet-usd',
  balance: { amount: '50.00', currency: 'USD' },
  status: 'ACTIVE',
  createdAt: '2026-02-01T12:00:00Z',
}

/** What is left of the daily limit; 50,000 MXN a day with `left` still available today. */
export const limits = (left = '50000.00', currency = 'MXN'): Schemas['WalletLimitsResponse'] => ({
  dailyOutgoingLimit: { amount: '50000.00', currency },
  remainingToday: { amount: left, currency },
})

export const bankAccount = (overrides: Partial<Schemas['BankAccountResponse']> = {}): Schemas['BankAccountResponse'] => ({
  id: 'bank-1',
  bankCode: '012',
  clabeLastFour: '4321',
  holderName: 'Ana López',
  createdAt: '2026-01-20T12:00:00Z',
  ...overrides,
})
