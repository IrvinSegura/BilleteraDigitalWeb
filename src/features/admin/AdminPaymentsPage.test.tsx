import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// openapi-fetch takes globalThis.fetch when the client is created, so the stub must exist before the import
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<(input: Request | string) => Promise<Response>>()
  globalThis.fetch = mock as typeof fetch
  return mock
})

vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ state: { status: 'signed-out' }, logout: vi.fn() }) }))

const { AdminPaymentsPage } = await import('./AdminPaymentsPage')

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const unmatched = {
  provider: 'STRIPE', id: 'txn_1', type: 'OTHER', providerType: 'adjustment', amountMinor: -700, feeMinor: 0,
  currency: 'mxn', status: 'UNMATCHED', note: 'Not handled: adjustment', createdAt: '2026-11-03T12:00:00Z',
}
const posted = {
  provider: 'STRIPE', id: 'txn_2', type: 'CHARGE', amountMinor: 10_000, feeMinor: 380, currency: 'mxn',
  status: 'POSTED', createdAt: '2026-11-03T11:00:00Z',
}

let balance: unknown
let transactions: unknown[]
let resolved: { url: string; body: unknown } | undefined

function serve() {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request
    const { pathname } = new URL(request.url)
    if (pathname.endsWith('/provider-balance-differences')) return json(200, balance)
    if (pathname.endsWith('/resolve')) {
      resolved = { url: pathname, body: await request.json() }
      transactions = [{ ...unmatched, status: 'RESOLVED', resolutionReason: 'Ajuste acordado', resolvedAt: '2026-11-03T13:00:00Z' }]
      return json(200, transactions[0])
    }
    return json(200, transactions)
  })
}

const listRequests = () => fetchMock.mock.calls
  .map(([input]) => new URL((input as Request).url))
  .filter((url) => url.pathname.endsWith('/provider-transactions'))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AdminPaymentsPage /></QueryClientProvider>)
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    resolved = undefined
    balance = { provider: 'STRIPE', holdsFunds: true, comparisons: [] }
    transactions = [unmatched, posted]
    serve()
  })

  it('asks for every status by default and says so', async () => {
    renderPage()
    expect(await screen.findByText('Cobro')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Todos los estados')
    expect(listRequests()[0].searchParams.has('status')).toBe(false)
  })

  it('shows movements in Spanish, with why one needs a person', async () => {
    renderPage()
    expect(await screen.findByText('La aplicación no maneja este tipo de movimiento: adjustment.')).toBeInTheDocument()
    expect(screen.getByText('Otro')).toBeInTheDocument()
    expect(screen.getByText('Sin conciliar')).toBeInTheDocument()
    expect(screen.queryByText('CHARGE')).not.toBeInTheDocument()
  })

  it('offers to resolve only what is unmatched, and sends the reason', async () => {
    renderPage()
    await screen.findByText('Cobro')
    expect(screen.getAllByRole('button', { name: 'Resolver' })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Resolver' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/no mueve dinero/)).toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole('textbox'), 'Ajuste acordado')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como resuelto' }))

    await waitFor(() => expect(resolved).toEqual({
      url: '/api/v1/admin/payments/provider-transactions/STRIPE/txn_1/resolve',
      body: { reason: 'Ajuste acordado' },
    }))
    expect(await screen.findByText('Resuelto')).toBeInTheDocument()
    expect(screen.getByText('Ajuste acordado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument()
  })

  it('compares the balances once there is a comparison', async () => {
    balance = {
      provider: 'STRIPE', holdsFunds: true, comparisons: [{
        currency: 'MXN', providerBalanceMinor: 10_500, recordedBalanceMinor: 10_000, differenceMinor: 500,
        comparedAt: '2026-11-03T12:00:00Z',
      }],
    }
    transactions = []
    renderPage()
    expect(await screen.findByText('$5.00')).toBeInTheDocument()
    expect(screen.getByText('$105.00')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('tells a provider with no balance from a comparison still to come', async () => {
    balance = { provider: 'SIMULATED', holdsFunds: false, comparisons: [] }
    const { unmount } = renderPage()
    expect(await screen.findByText(/no guarda dinero/)).toBeInTheDocument()
    unmount()

    balance = { provider: 'STRIPE', holdsFunds: true, comparisons: [] }
    renderPage()
    expect(await screen.findByText(/Aún no hay comparación/)).toBeInTheDocument()
    expect(screen.queryByText(/no guarda dinero/)).not.toBeInTheDocument()
  })
})
