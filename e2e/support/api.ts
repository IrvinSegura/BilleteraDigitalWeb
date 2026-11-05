import { randomUUID } from 'node:crypto'

import { request as playwrightRequest } from '@playwright/test'

import { BASE_URL } from './env'
import { emailedLink } from './mailpit'
import { nextTotp } from './totp'

export interface TestUser {
  email: string
  password: string
  fullName: string
  /** Access token from the sign-in that set the user up, for checking results through the API. */
  token: string
  /** Base32 secret of the authenticator app, when two-factor is on. */
  twoFactorSecret?: string
}

/**
 * Calls the API. The API rate-limits sign-ins per address (20 a minute) and every test runs from localhost,
 * so a 429 waits as long as the API asks and tries again instead of failing the run.
 */
export async function apiCall<T = unknown>(method: string, path: string, options: {
  token?: string
  data?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL })
  try {
    for (let attempt = 0; ; attempt++) {
      const response = await context.fetch(path, {
        method,
        data: options.data,
        headers: { ...options.headers, ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      })
      if (response.status() === 429 && attempt < 4) {
        const seconds = Number(response.headers()['retry-after']) || 5
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
        continue
      }
      if (!response.ok()) {
        throw new Error(`${method} ${path} answered ${response.status()}: ${await response.text()}`)
      }
      // Some answers have no body: 204, and 202 from sign-up
      const body = await response.text()
      return (body ? JSON.parse(body) : undefined) as T
    }
  } finally {
    await context.dispose()
  }
}

export function newUserDetails(label: string) {
  const id = randomUUID().slice(0, 8)
  return {
    email: `e2e-${label}-${Date.now()}-${id}@wallet.local`,
    // A fresh one per user: these accounts exist only in the local database
    password: `e2e-pass-${randomUUID()}`,
    fullName: `Prueba ${label[0]!.toUpperCase()}${label.slice(1)}`,
  }
}

/**
 * A new user, set up through the API so each test starts from a known state: email verified, an MXN wallet and,
 * with twoFactor, an authenticator app.
 */
export async function createUser(label: string, { twoFactor = false } = {}): Promise<TestUser> {
  const details = newUserDetails(label)
  await apiCall('POST', '/api/v1/auth/register', { data: details })

  const link = await emailedLink(details.email, 'Confirma tu correo electrónico', '/verify-email')
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')
  await apiCall('POST', '/api/v1/auth/email-verification/confirm', { data: { token } })

  const { accessToken } = await apiCall<{ accessToken: string }>('POST', '/api/v1/auth/login', {
    data: { email: details.email, password: details.password },
  })
  const wallets = await apiCall<{ balance?: { currency?: string } }[]>('GET', '/api/v1/wallets', { token: accessToken })
  if (!wallets.some((w) => w.balance?.currency === 'MXN')) {
    await apiCall('POST', '/api/v1/wallets', { token: accessToken, data: { currency: 'MXN' } })
  }

  const user: TestUser = { ...details, token: accessToken }
  if (twoFactor) {
    const { secret } = await apiCall<{ secret: string }>('POST', '/api/v1/users/me/two-factor', {
      token: accessToken,
      data: { currentPassword: details.password },
    })
    await apiCall('POST', '/api/v1/users/me/two-factor/confirm', { token: accessToken, data: { code: await nextTotp(secret) } })
    user.twoFactorSecret = secret
  }
  return user
}

/** The user's MXN wallet as the API reports it. */
export async function mxnWallet(user: TestUser) {
  const wallets = await apiCall<{ id: string; status: string; balance?: { currency?: string } }[]>(
    'GET', '/api/v1/wallets', { token: user.token })
  return wallets.find((w) => w.balance?.currency === 'MXN')!
}

/** Deposits into the user's MXN wallet through the API; the local API's simulated provider pays at once. */
export async function deposit(user: TestUser, amount: number) {
  const wallet = await mxnWallet(user)
  await apiCall('POST', `/api/v1/wallets/${wallet.id}/deposits`, {
    token: user.token,
    headers: { 'Idempotency-Key': randomUUID() },
    data: { amount },
  })
}

/** Sends money between two test users through the API, proving it is the sender with the password. */
export async function transfer(from: TestUser, to: TestUser, amount: number, description?: string) {
  const wallet = await mxnWallet(from)
  await apiCall('POST', '/api/v1/transfers', {
    token: from.token,
    headers: { 'Idempotency-Key': randomUUID() },
    data: { sourceWalletId: wallet.id, recipientEmail: to.email, amount, description, currentPassword: from.password },
  })
}

/** The user's MXN balance as the API reports it, e.g. "250.00". */
export async function mxnBalance(user: TestUser): Promise<string> {
  const wallets = await apiCall<{ balance?: { amount?: string | number; currency?: string } }[]>(
    'GET', '/api/v1/wallets', { token: user.token })
  const amount = wallets.find((w) => w.balance?.currency === 'MXN')?.balance?.amount
  return Number(amount ?? 0).toFixed(2)
}
