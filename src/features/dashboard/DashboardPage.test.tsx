import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { bankAccount, limits, mxnWallet, usdWallet } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
// The chart library draws nothing useful in a simulated browser
vi.mock('@/features/wallets/LazyBalanceChart', () => ({ LazyBalanceChart: () => <div data-testid="balance-chart" /> }))

const { DashboardPage } = await import('./DashboardPage')
const { MoneyActionsProvider } = await import('@/features/money/MoneyActions')

const movement = (id: string, type: string, direction: string, amount: string) => ({
  transactionId: id, type, direction, operationId: `op-${id}`, amount: { amount, currency: 'MXN' },
  balanceAfter: { amount: '1000.00', currency: 'MXN' }, createdAt: '2026-11-04T15:00:00Z',
})

const page = (items: unknown[]) => ({ items, page: 0, size: 6, hasNext: false })

function open() {
  return renderWithProviders(<MoneyActionsProvider><DashboardPage /></MoneyActionsProvider>)
}

describe('DashboardPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    api.on('GET', '/api/v1/wallets', [mxnWallet])
    api.on('GET', '/api/v1/wallets/{walletId}/movements', page([
      movement('t-1', 'DEPOSIT', 'IN', '500.00'),
      movement('t-2', 'TRANSFER', 'OUT', '120.00'),
    ]))
    api.on('GET', '/api/v1/wallets/{walletId}/summary', {
      month: '2026-11', moneyIn: { amount: '500.00', currency: 'MXN' }, moneyOut: { amount: '120.00', currency: 'MXN' },
    })
    api.on('GET', '/api/v1/wallets/{walletId}/balance-history', { points: [] })
    api.on('GET', '/api/v1/wallets/{walletId}/limits', limits())
    api.on('GET', '/api/v1/bank-accounts', [])
    api.on('GET', '/api/v1/transfers/recipients', [])
  })

  it('greets by first name and shows the month money in and out', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Ana' })).toBeInTheDocument()
    expect(await screen.findByText('Entradas este mes')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('$500.00', { selector: 'p' })).toBeInTheDocument())
    expect(screen.getAllByText('$120.00').length).toBeGreaterThan(0)
  })

  it('lists the latest movements with a link to all of them', async () => {
    open()
    expect(await screen.findByText('Depósito')).toBeInTheDocument()
    expect(screen.getByText('Transferencia enviada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver todo' })).toHaveAttribute('href', '/wallets/wallet-mxn')
    expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/movements')[0]!.query.get('size')).toBe('6')
  })

  it('switches between currencies', async () => {
    api.on('GET', '/api/v1/wallets', [mxnWallet, usdWallet])
    open()
    const tabs = await screen.findByRole('tablist')
    await userEvent.click(within(tabs).getByRole('tab', { name: 'USD' }))
    expect(within(tabs).getByRole('tab', { name: 'USD' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/summary')
      .some((c) => c.path.includes('wallet-usd'))).toBe(true))
  })

  it('invites opening a first wallet', async () => {
    api.on('GET', '/api/v1/wallets', [])
    open()
    expect(await screen.findByText('Abre tu primera billetera')).toBeInTheDocument()
  })

  it('tracks what is left to secure the account, and hides once complete', async () => {
    auth.reset(testUser({ emailVerified: true, twoFactorEnabled: false }))
    const { unmount } = open()
    expect(await screen.findByText('Protege y completa tu cuenta')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Activa la verificación en dos pasos/ })).toHaveAttribute('href', '/settings#security')
    unmount()

    auth.reset(testUser({ twoFactorEnabled: true }))
    api.on('GET', '/api/v1/bank-accounts', [bankAccount()])
    open()
    await screen.findByText('Depósito')
    expect(screen.queryByText('Protege y completa tu cuenta')).not.toBeInTheDocument()
  })

  it('offers a retry when the wallets fail to load', async () => {
    api.on('GET', '/api/v1/wallets', problem(500, 'INTERNAL_ERROR'))
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.callsTo('GET', '/api/v1/wallets')).toHaveLength(2))
  })

  it('opens the send dialog from the balance card', async () => {
    open()
    await screen.findByText('Depósito')
    await userEvent.click(screen.getByRole('button', { name: /Enviar/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Enviar dinero')
  })
})
