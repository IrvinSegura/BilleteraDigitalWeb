import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { AdminHomePage } = await import('./AdminHomePage')
const { lastDays, usersToday } = await import('./home-series')

const IDENTITY = '/api/v1/admin/identity-verifications'
const TICKETS = '/api/v1/admin/support/tickets'
const ADJUSTMENTS = '/api/v1/admin/adjustments'
const COUNTS = '/api/v1/admin/payments/provider-transactions/counts'
const DAILY = '/api/v1/admin/operations/daily'
const SIGNUPS = '/api/v1/admin/users/signups'
const RECONCILIATIONS = '/api/v1/admin/reconciliations'
const today = usersToday()
// In the 30 days before the default period
const before = lastDays(31)[0]!
const AT = '2026-11-05T12:00:00Z'

function serve(identity: number, tickets: number, adjustments: number, unmatched: number) {
  api.on('GET', IDENTITY, { items: [], page: 0, size: 1, hasNext: false, pending: identity })
  api.on('GET', TICKETS, { items: [], page: 0, size: 1, hasNext: false, open: tickets })
  api.on('GET', ADJUSTMENTS, { items: [], page: 0, size: 1, hasNext: false, pending: adjustments })
  api.on('GET', COUNTS, { unmatched, pending: 0 })
}

function serveOverview() {
  api.on('GET', '/api/v1/admin/ledger/customer-balances', [
    { currency: 'MXN', balanceMinor: 1250000, accounts: 8 },
    { currency: 'USD', balanceMinor: 5000, accounts: 2 },
  ])
  api.on('GET', '/api/v1/admin/users/stats', { total: 1200, active: 1190, disabled: 6, unverified: 35, admins: 2 })
  api.on('GET', '/api/v1/admin/wallets/stats', { total: 90, frozen: 3 })
  api.on('GET', DAILY, [
    { date: today, kind: 'deposit', count: 2, amount: { amount: '300.00', currency: 'MXN' } },
    { date: today, kind: 'withdrawal', count: 1, amount: { amount: '100.00', currency: 'MXN' } },
    { date: today, kind: 'transfer', count: 4, amount: { amount: '20.00', currency: 'USD' } },
    { date: before, kind: 'deposit', count: 2, amount: { amount: '800.00', currency: 'MXN' } },
  ])
  api.on('GET', SIGNUPS, [{ date: today, count: 5 }, { date: before, count: 4 }])
  api.on('GET', '/api/v1/admin/support/summary', { withBot: 1, queued: 4, assigned: 2, resolved: 30, surveys: 12, averageScore: 4.56 })
  api.on('GET', '/api/v1/admin/support/bot/summary', { questions: 10, answered: 7 })
  api.on('GET', RECONCILIATIONS, [{ id: 'r1', status: 'DIFFERENCES', startedAt: AT, discrepancies: [{}, {}] }])
  api.on('GET', '/api/v1/admin/operations/pending', [{ id: 'p1', kind: 'deposit', createdAt: AT }])
  api.on('GET', '/api/v1/admin/audit-events', { items: [{ id: 'e1', action: 'IDENTITY_VERIFIED', details: 'approved', occurredAt: AT }], page: 0, size: 6, hasNext: false })
}

describe('AdminHomePage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(testUser({ role: 'ADMIN' }))
  })

  it('shows what waits for attention, each with the way to it', async () => {
    serve(4, 2, 1, 7)
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByRole('link', { name: /INE por revisar.*4/ })).toHaveAttribute('href', '/admin/identity')
    expect(await screen.findByRole('link', { name: /Tickets abiertos.*2/ })).toHaveAttribute('href', '/admin/tickets')
    expect(await screen.findByRole('link', { name: /Ajustes por aprobar.*1/ })).toHaveAttribute('href', '/admin/adjustments')
    expect(await screen.findByRole('link', { name: /Movimientos sin conciliar.*7/ })).toHaveAttribute('href', '/admin/payments?status=UNMATCHED')
    expect(screen.queryByText('Todo al día.')).not.toBeInTheDocument()
    expect(api.callsTo('GET', IDENTITY)[0]!.query.get('status')).toBe('PENDING_REVIEW')
    expect(api.callsTo('GET', ADJUSTMENTS)[0]!.query.get('status')).toBe('PENDING_APPROVAL')
  })

  it('says so when nothing waits', async () => {
    serve(0, 0, 0, 0)
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByText('Todo al día.')).toBeInTheDocument()
  })

  it('keeps the rest when one count cannot be read', async () => {
    serve(4, 2, 1, 7)
    api.on('GET', COUNTS, problem(500, 'INTERNAL'))
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByRole('link', { name: /INE por revisar.*4/ })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Movimientos sin conciliar.*—/ })).toBeInTheDocument()
    expect(screen.queryByText('Todo al día.')).not.toBeInTheDocument()
  })

  it('points to the second factor when the console is closed without it', async () => {
    for (const path of [IDENTITY, TICKETS, ADJUSTMENTS, COUNTS]) {
      api.on('GET', path, problem(403, 'ADMIN_TWO_FACTOR_REQUIRED'))
    }
    auth.reset(testUser({ role: 'ADMIN', twoFactorEnabled: false }))
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByRole('link', { name: 'Activarla ahora' })).toHaveAttribute('href', '/settings#security')
  })

  it('sums up the customers\' money, what moved and who joined', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    renderWithProviders(<AdminHomePage />)

    const metrics = within(screen.getByLabelText('Cifras generales'))
    expect(await metrics.findByText('$12,500.00')).toBeInTheDocument()
    expect(await metrics.findByText(/10 billeteras · también \$50\.00.*USD/)).toBeInTheDocument()
    expect(await metrics.findByText('$400.00')).toBeInTheDocument()
    // Every kind and currency, and only in the period
    expect(await metrics.findByText('7')).toBeInTheDocument()
    expect(await metrics.findByText('5')).toBeInTheDocument()
  })

  it('compares the period with the one before', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    renderWithProviders(<AdminHomePage />)

    const metrics = within(screen.getByLabelText('Cifras generales'))
    // $400 against $800, 7 operations against 2, 5 customers against 4
    expect(await metrics.findByText('−50%')).toBeInTheDocument()
    expect(await metrics.findByText('+250%')).toBeInTheDocument()
    expect(await metrics.findByText('+25%')).toBeInTheDocument()
    expect(metrics.getAllByText(/contra los 30 días previos/)).toHaveLength(3)
  })

  it('follows the chosen currency in the money it shows', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    renderWithProviders(<AdminHomePage />)
    const metrics = within(screen.getByLabelText('Cifras generales'))
    await metrics.findByText('$12,500.00')

    await userEvent.click(screen.getByRole('button', { name: 'USD' }))

    expect(metrics.getByText('$50.00')).toBeInTheDocument()
    expect(metrics.getByText(/también \$12,500\.00.*MXN/)).toBeInTheDocument()
    expect(metrics.getByText('$20.00')).toBeInTheDocument()
  })

  it('splits accounts and wallets by their state', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByText('1,200')).toBeInTheDocument()
    expect((await screen.findByText('Congeladas')).nextSibling).toHaveTextContent('3')
    expect((await screen.findByText('Operando')).nextSibling).toHaveTextContent('87')
  })

  it('shows what moved per day in the chosen currency, also as a table', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    renderWithProviders(<AdminHomePage />)

    const legend = within(await screen.findByRole('list', { name: 'Total del periodo por tipo' }))
    expect(legend.getByText('$300.00')).toBeInTheDocument()
    expect(legend.getByText('$100.00')).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Dinero movido por día en MXN' })).getAllByRole('row')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'USD' }))

    expect(await screen.findByRole('table', { name: 'Dinero movido por día en USD' })).toBeInTheDocument()
    expect(legend.getByText('$20.00')).toBeInTheDocument()
  })

  it('reads another period when asked, and keeps it in the address', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    renderWithProviders(<AdminHomePage />)
    // Twice the period, to compare it with the one before
    await waitFor(() => expect(api.callsTo('GET', DAILY)[0]!.query.get('days')).toBe('60'))

    await userEvent.click(screen.getByRole('button', { name: '7 días' }))

    await waitFor(() => expect(api.callsTo('GET', DAILY).at(-1)!.query.get('days')).toBe('14'))
    expect(api.callsTo('GET', SIGNUPS).at(-1)!.query.get('days')).toBe('14')
    expect(currentLocation()).toContain('days=7')
  })

  it('says how support, the books and the provider are doing', async () => {
    serve(0, 0, 0, 3)
    serveOverview()
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByText('4.6 / 5')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Libro mayor.*2 diferencias/ })).toHaveAttribute('href', '/admin/reconciliations')
    expect(await screen.findByRole('link', { name: /Proveedor de pagos.*3 movimientos sin conciliar/ })).toHaveAttribute('href', '/admin/payments')
    expect(await screen.findByRole('link', { name: /en espera.*1 en espera/ })).toHaveAttribute('href', '/admin/operations')
    expect(await screen.findByText('3 por revisar')).toBeInTheDocument()
    expect(await screen.findByRole('columnheader', { name: 'Evento' })).toBeInTheDocument()
    expect(await screen.findByText('Identidad verificada')).toBeInTheDocument()
  })

  it('keeps the other parts when one cannot be read', async () => {
    serve(0, 0, 0, 0)
    serveOverview()
    api.on('GET', DAILY, problem(500, 'INTERNAL'))
    renderWithProviders(<AdminHomePage />)

    expect(await screen.findByRole('table', { name: 'Clientes nuevos por día' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })
})
