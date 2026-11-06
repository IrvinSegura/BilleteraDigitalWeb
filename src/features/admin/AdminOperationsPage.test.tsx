import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

// openapi-fetch takes globalThis.fetch when the client is created, so the stub must exist before the import
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<(input: Request | string) => Promise<Response>>()
  globalThis.fetch = mock as typeof fetch
  return mock
})

vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ state: { status: 'signed-out' }, logout: vi.fn() }) }))

const { AdminOperationsPage } = await import('./AdminOperationsPage')

const ID = '3f2a91bc-1111-4222-8333-444455556666'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const requested = () => fetchMock.mock.calls.map(([input]) => new URL((input as Request).url).pathname)

function renderPage(entry = '/admin/operations') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}><AdminOperationsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

async function search(id = ID) {
  await userEvent.type(screen.getByLabelText('Identificador'), id)
  await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
}

/** Answers with `found` for the path containing `where`, 404 for every other. */
function serve(where: string, found: unknown) {
  fetchMock.mockImplementation(async (input) => {
    return new URL((input as Request).url).pathname.includes(where)
      ? json(200, found)
      : json(404, { code: 'NOT_FOUND' })
  })
}

describe('AdminOperationsPage', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(async () => {
    await i18n.changeLanguage('es')
  })

  it('starts with no type filter', () => {
    renderPage()
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Todos')
  })

  it('looks an id up under every type unless a filter is chosen, and shows what it finds', async () => {
    serve('/deposits/', { amount: { amount: '150.00', currency: 'MXN' }, status: 'COMPLETED' })
    renderPage()
    await search()

    expect(await screen.findByText('Depósito')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
    expect(requested().filter((path) => !path.startsWith('/api/v1/admin/operations/')).toSorted()).toEqual([
      `/api/v1/admin/deposits/${ID}`,
      `/api/v1/admin/transfers/${ID}`,
      `/api/v1/admin/wallets/${ID}`,
      `/api/v1/admin/withdrawals/${ID}`,
    ])
  })

  it('asks only for the type a link filters by', async () => {
    serve('/withdrawals/', { amount: { amount: '20.00', currency: 'USD' }, status: 'PAID' })
    renderPage(`/admin/operations?type=withdrawal&id=${ID}`)

    expect(await screen.findByText('Retiro')).toBeInTheDocument()
    expect(requested()).toEqual([`/api/v1/admin/withdrawals/${ID}`])
  })

  it('treats a type it does not know as no filter', async () => {
    serve('/transfers/', { amount: { amount: '5.00', currency: 'MXN' } })
    renderPage(`/admin/operations?type=nonsense&id=${ID}`)

    expect(await screen.findByText('Transferencia')).toBeInTheDocument()
    expect(requested()).toHaveLength(4)
  })

  it('writes what it found in a language chosen afterwards', async () => {
    serve('/deposits/', { amount: { amount: '150.00', currency: 'MXN' }, status: 'COMPLETED' })
    renderPage(`/admin/operations?type=deposit&id=${ID}`)
    expect(await screen.findByText('Motivo de rechazo')).toBeInTheDocument()

    await act(() => i18n.changeLanguage('en'))

    expect(screen.getByText('Rejection reason')).toBeInTheDocument()
    expect(screen.getAllByText('Deposit')).toHaveLength(2)
    expect(screen.queryByText('Motivo de rechazo')).not.toBeInTheDocument()
  })

  it('says so when no type has that id', async () => {
    serve('/nothing/', {})
    renderPage()
    await search()

    expect(await screen.findByText('No se encontró la operación')).toBeInTheDocument()
  })

  it('reports a real failure instead of saying it found nothing', async () => {
    fetchMock.mockImplementation(async () => json(403, { code: 'FORBIDDEN' }))
    renderPage()
    await search()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso'))
    expect(screen.queryByText('No se encontró la operación')).not.toBeInTheDocument()
  })

  it('still shows the operation when another type fails', async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname
      if (path.includes('/deposits/')) return json(200, { amount: { amount: '1.00', currency: 'MXN' }, status: 'COMPLETED' })
      return path.includes('/wallets/') ? json(500, {}) : json(404, {})
    })
    renderPage()
    await search()

    expect(await screen.findByText('Depósito')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  describe('without an id', () => {
    const USER = '9a8b7c6d-1111-4222-8333-444455556666'

    it('sums what moved in the last week and lists what is still waiting, oldest first', async () => {
      fetchMock.mockImplementation(async (input) => {
        const url = new URL((input as Request).url)
        if (url.pathname.endsWith('/operations/totals')) {
          return json(200, [
            { kind: 'transfer', count: 3, amount: { amount: '300.00', currency: 'MXN' } },
            { kind: 'deposit', count: 1, amount: { amount: '50.00', currency: 'USD' } },
          ])
        }
        if (url.pathname.endsWith('/operations/pending')) {
          return json(200, [{ kind: 'withdrawal', id: ID, userId: USER, walletId: ID, amount: { amount: '75.00', currency: 'MXN' }, createdAt: '2026-11-01T10:00:00Z' }])
        }
        return json(404, { code: 'NOT_FOUND' })
      })
      renderPage()

      expect(await screen.findByText('3 operaciones')).toBeInTheDocument()
      expect(screen.getByText('1 operación')).toBeInTheDocument()
      expect(screen.getByText('Sin operaciones')).toBeInTheDocument()
      expect(await screen.findByRole('link', { name: 'Ver' })).toHaveAttribute('href', `/admin/operations?type=withdrawal&id=${ID}`)
      expect(screen.getByText('$75.00')).toBeInTheDocument()
      const totals = fetchMock.mock.calls.map(([input]) => new URL((input as Request).url)).find((url) => url.pathname.endsWith('/totals'))
      expect(totals?.searchParams.get('days')).toBe('7')
    })

    it('says when nothing is waiting', async () => {
      fetchMock.mockImplementation(async () => json(200, []))
      renderPage()

      expect(await screen.findByText('Nada pendiente')).toBeInTheDocument()
    })
  })
})
