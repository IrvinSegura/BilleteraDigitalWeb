import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// openapi-fetch takes globalThis.fetch when the client is created, so the stub must exist before the import
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<(input: Request | string) => Promise<Response>>()
  globalThis.fetch = mock as typeof fetch
  return mock
})

vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ state: { status: 'signed-out' }, logout: vi.fn() }) }))

const { AdminAuditPage } = await import('./AdminAuditPage')

const ACTOR = '3f2a91bc-1111-4222-8333-444455556666'
const WALLET = 'aaaabbbb-1111-4222-8333-444455556666'
const WITHDRAWAL = 'ccccdddd-1111-4222-8333-444455556666'

const event = {
  id: 'e1', action: 'WITHDRAWAL_REQUESTED', occurredAt: '2026-11-03T12:00:00Z', actorId: ACTOR, targetType: 'WALLET',
  targetId: WALLET, details: `withdrawal ${WITHDRAWAL}: 25.00 MXN`,
}

const lastRequest = () => new URL((fetchMock.mock.lastCall![0] as Request).url)

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function renderPage(entry = '/admin/audit') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}><AdminAuditPage /><Where /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminAuditPage', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [event], hasNext: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }))
  })

  it('shows the action, target and details in Spanish', async () => {
    renderPage()
    expect(await screen.findByText('Retiro solicitado')).toBeInTheDocument()
    expect(screen.getByText('Billetera')).toBeInTheDocument()
    expect(screen.getAllByText(/^Retiro ccccdddd.*\$25\.00$/)[0]).toBeInTheDocument()
    expect(screen.queryByText(/withdrawal/i)).not.toBeInTheDocument()
  })

  it('links the actor and the target, and copying does not navigate', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } })
    renderPage()
    await screen.findByText('Retiro solicitado')
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      `/admin/users/${ACTOR}`,
      `/admin/operations?type=wallet&id=${WALLET}`,
    ])
    links.forEach((link) => expect(link.querySelector('button')).toBeNull())

    await userEvent.click(screen.getAllByRole('button', { name: 'Copiar identificador' })[0])
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/audit')
  })

  it('applies the filters a link carries, with the day whole', async () => {
    renderPage('/admin/audit?action=USER_SIGNED_IN&from=2026-11-01&to=2026-11-03')
    await screen.findByText('Retiro solicitado')

    const query = lastRequest().searchParams
    expect(query.get('action')).toBe('USER_SIGNED_IN')
    expect(query.get('from')).toBe(new Date('2026-11-01T00:00:00').toISOString())
    expect(query.get('to')).toBe(new Date('2026-11-04T00:00:00').toISOString())
    expect(screen.getByRole('combobox', { name: 'Acción' })).toHaveTextContent('Inicio de sesión')
  })

  it('filters by date from the form, and refuses a range backwards', async () => {
    renderPage()
    await screen.findByText('Retiro solicitado')

    await userEvent.type(screen.getByLabelText('Desde'), '2026-11-03')
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-11-01')
    expect(screen.getByText('La fecha inicial no puede ser posterior a la final.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Hasta'))
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    await waitFor(() => expect(lastRequest().searchParams.get('from')).toBe(new Date('2026-11-03T00:00:00').toISOString()))
    expect(lastRequest().searchParams.has('to')).toBe(false)
  })

  it('ignores an action it does not know', async () => {
    renderPage('/admin/audit?action=nonsense')
    await screen.findByText('Retiro solicitado')
    expect(lastRequest().searchParams.has('action')).toBe(false)
  })
})
