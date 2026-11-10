import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { AdminAdjustmentsPage } = await import('./AdminAdjustmentsPage')
const { AdjustmentDialog } = await import('./AdjustmentDialog')

const ID = '11111111-2222-4333-8444-555555555555'
const WALLET = 'aaaaaaaa-0000-4000-8000-000000000001'
const LIST = '/api/v1/admin/adjustments'
const AT = '2026-11-05T18:00:00Z'
const pending = {
  id: ID, walletId: WALLET, userId: 'user-9', customerName: 'Ana López', customerEmail: 'ana@example.com', direction: 'CREDIT',
  amount: { amount: '5000.00', currency: 'MXN' }, reason: 'Depósito que no llegó', status: 'PENDING_APPROVAL', secondApproval: true,
  requestedBy: 'other-admin', requestedByName: 'Laura Pérez', requestedAt: AT,
}

function render(route = '/admin/adjustments') {
  renderWithProviders(<AdminAdjustmentsPage />, { route, path: '/admin/adjustments/:adjustmentId?' })
}

describe('AdminAdjustmentsPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(testUser({ role: 'ADMIN' }))
    api.on('GET', LIST, { items: [pending], page: 0, size: 20, hasNext: false, pending: 1 })
    api.on('GET', `${LIST}/{id}`, pending)
  })

  it('lists what waits for approval first, with its sign', async () => {
    render()

    const row = (await screen.findByRole('link', { name: 'Ana López' })).closest('tr')!
    expect(within(row).getByText('+$5,000.00 MXN')).toBeInTheDocument()
    expect(within(row).getByText('Laura Pérez')).toBeInTheDocument()
    expect(screen.getByText('1 ajuste espera aprobación.')).toBeInTheDocument()
    expect(api.callsTo('GET', LIST)[0]!.query.get('status')).toBe('PENDING_APPROVAL')
  })

  it('lets a second administrator apply it', async () => {
    api.on('POST', `${LIST}/{id}/approve`, { ...pending, status: 'APPLIED', decidedByName: 'Yo', decidedAt: AT, journalEntryId: 'bbbbbbbb-0000-4000-8000-000000000002' })
    render(`/admin/adjustments/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar y aplicar' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Abono de \$5,000\.00 MXN a Ana López/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar y aplicar' }))

    expect(await screen.findByText('Aplicado')).toBeInTheDocument()
    expect(api.callsTo('POST', `${LIST}/{id}/approve`)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Aprobar y aplicar' })).not.toBeInTheDocument()
  })

  it('never offers its own requester to approve it, only to withdraw it', async () => {
    auth.reset(testUser({ role: 'ADMIN', id: 'other-admin' }))
    render(`/admin/adjustments/${ID}`)

    expect(await screen.findByText(/otro administrador debe aprobarlo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar y aplicar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirar mi solicitud' })).toBeInTheDocument()
  })

  it('rejects it with a reason', async () => {
    api.on('POST', `${LIST}/{id}/reject`, { ...pending, status: 'REJECTED', rejectionReason: 'Sin evidencia', decidedAt: AT })
    render(`/admin/adjustments/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox'), 'Sin evidencia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }))

    expect(await screen.findByText('Rechazado')).toBeInTheDocument()
    expect(api.callsTo('POST', `${LIST}/{id}/reject`)[0]!.body).toEqual({ reason: 'Sin evidencia' })
  })

  it('speaks to the administrator, not the owner, when the wallet falls short', async () => {
    api.on('GET', `${LIST}/{id}`, { ...pending, direction: 'DEBIT' })
    api.on('POST', `${LIST}/{id}/approve`, problem(422, 'INSUFFICIENT_FUNDS'))
    render(`/admin/adjustments/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar y aplicar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar y aplicar' }))

    expect(await within(dialog).findByText('La billetera no tiene saldo suficiente para este cargo.')).toBeInTheDocument()
  })
})

describe('AdjustmentDialog', () => {
  const wallets = '/api/v1/admin/users/{id}/wallets'
  beforeEach(() => {
    api.reset()
    auth.reset(testUser({ role: 'ADMIN' }))
    api.on('GET', wallets, [{ id: WALLET, balance: { amount: '100.00', currency: 'MXN' }, status: 'ACTIVE' }])
  })

  async function fill() {
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar saldo' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Monto' }), '250')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Motivo' }), 'Depósito que no llegó')
    return dialog
  }

  it('credits the only wallet, tied to the ticket, with the amount on the button', async () => {
    api.on('POST', '/api/v1/admin/adjustments', { ...pending, status: 'APPLIED' })
    renderWithProviders(<AdjustmentDialog userId="user-9" ticketId="ticket-1" />)

    const dialog = await fill()
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Abonar $250.00 MXN' }))

    await waitFor(() => expect(api.callsTo('POST', '/api/v1/admin/adjustments')[0]?.body).toEqual({
      walletId: WALLET, direction: 'CREDIT', amount: 250, reason: 'Depósito que no llegó', ticketId: 'ticket-1',
    }))
  })

  it('can take money too', async () => {
    api.on('POST', '/api/v1/admin/adjustments', { ...pending, direction: 'DEBIT', status: 'APPLIED' })
    renderWithProviders(<AdjustmentDialog userId="user-9" walletId={WALLET} />)

    const dialog = await fill()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cargo' }))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Cargar $250.00 MXN' }))

    await waitFor(() => expect(api.callsTo('POST', '/api/v1/admin/adjustments')[0]?.body).toMatchObject({ direction: 'DEBIT' }))
  })

  it('waits for a reason before moving anything', async () => {
    renderWithProviders(<AdjustmentDialog userId="user-9" walletId={WALLET} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ajustar saldo' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Monto' }), '250')

    expect(await within(dialog).findByRole('button', { name: 'Abonar $250.00 MXN' })).toBeDisabled()
  })
})
