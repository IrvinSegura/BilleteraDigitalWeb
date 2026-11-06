import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ state: { status: 'signed-out' }, logout: vi.fn() }) }))

const { AdminWalletsPage } = await import('./AdminWalletsPage')

const OWNER = '3f2a91bc-1111-4222-8333-444455556666'
const frozen = {
  id: '7f0c2a9e-0000-4000-8000-000000000001', ownerId: OWNER, balance: { amount: '1250.50', currency: 'USD' },
  status: 'FROZEN', createdAt: '2026-10-01T12:00:00Z',
}
const page = (items: unknown[], hasNext = false) => ({ items, page: 0, size: 20, hasNext })
const lastList = () => api.calls.filter((c) => c.path === '/api/v1/admin/wallets').at(-1)!

const open = (route = '/admin/wallets') => renderWithProviders(<AdminWalletsPage />, { route })

describe('AdminWalletsPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', '/api/v1/admin/wallets', page([frozen]))
    api.on('GET', '/api/v1/admin/wallets/stats', { total: 40, frozen: 3 })
  })

  it('shows the counts, working out the active wallets', async () => {
    open()
    const stats = screen.getByLabelText('Resumen de billeteras')
    await waitFor(() => expect(within(stats).getByText('Congeladas').nextSibling).toHaveTextContent('3'))
    expect(within(stats).getByText('Billeteras').nextSibling).toHaveTextContent('40')
    expect(within(stats).getByText('Activas').nextSibling).toHaveTextContent('37')
  })

  it('lists each wallet with its balance, its state and a link to its owner', async () => {
    open()
    const row = (await screen.findByText('$1,250.50')).closest('tr')!
    expect(within(row).getByText('USD')).toBeInTheDocument()
    expect(within(row).getByText('Congelada')).toBeInTheDocument()
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/admin/users/${OWNER}`)
  })

  it('filters by status, keeping it in the address', async () => {
    open()
    await screen.findByText('$1,250.50')
    await userEvent.click(within(screen.getByRole('group', { name: 'Estado de la billetera' })).getByRole('button', { name: 'Congelada' }))
    await waitFor(() => expect(lastList().query.get('status')).toBe('FROZEN'))
    expect(currentLocation()).toBe('/admin/wallets?status=FROZEN')
  })

  it('reads the filter and the page from the address', async () => {
    open('/admin/wallets?status=FROZEN&page=3')
    await screen.findByText('$1,250.50')
    expect(lastList().query.get('status')).toBe('FROZEN')
    expect(lastList().query.get('page')).toBe('3')
  })

  it('says when no wallet matches', async () => {
    api.on('GET', '/api/v1/admin/wallets', page([]))
    open()
    expect(await screen.findByText('No hay billeteras')).toBeInTheDocument()
  })
})
