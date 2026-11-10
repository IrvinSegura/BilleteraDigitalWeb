import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { AdminTicketsPage } = await import('./AdminTicketsPage')

const ID = '11111111-2222-4333-8444-555555555555'
const DEPOSIT = 'aaaaaaaa-0000-4000-8000-000000000001'
const LIST = '/api/v1/admin/support/tickets'
const AT = '2026-11-05T18:00:00Z'
const ticket = {
  id: ID, conversationId: 'case-1', userId: 'user-1', status: 'OPEN', operationKind: 'deposit', operationId: DEPOSIT,
  description: 'El cliente pagó y el depósito no llegó', openedByName: 'Laura Pérez', customerName: 'Ana López', createdAt: AT,
}
const detail = {
  ...ticket, customerEmail: 'ana@example.com',
  operation: { kind: 'deposit', id: DEPOSIT, status: 'PENDING', amount: { amount: '250.00', currency: 'MXN' }, createdAt: AT },
}

function render(route = '/admin/tickets') {
  renderWithProviders(<AdminTicketsPage />, { route, path: '/admin/tickets/:ticketId?' })
}

describe('AdminTicketsPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(testUser({ role: 'ADMIN' }))
    api.on('GET', LIST, { items: [ticket], page: 0, size: 20, hasNext: false, open: 1 })
    api.on('GET', `${LIST}/{id}`, detail)
  })

  it('lists the open tickets first, with who escalated them', async () => {
    render()

    const row = (await screen.findByRole('link', { name: 'Ana López' })).closest('tr')!
    expect(within(row).getByText('Depósito')).toBeInTheDocument()
    expect(within(row).getByText('Laura Pérez')).toBeInTheDocument()
    expect(screen.getByText('1 ticket abierto.')).toBeInTheDocument()
    expect(api.callsTo('GET', LIST)[0]!.query.get('status')).toBe('OPEN')
  })

  it('shows the customer, the operation and the way to fix it', async () => {
    render(`/admin/tickets/${ID}`)

    expect(await screen.findByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', '/admin/users/user-1')
    expect(screen.getByText('El cliente pagó y el depósito no llegó')).toBeInTheDocument()
    expect(screen.getByText('$250.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir en Operaciones/ })).toHaveAttribute('href', `/admin/operations?type=deposit&id=${DEPOSIT}`)
    expect(screen.getByRole('link', { name: /Ver la conversación/ })).toHaveAttribute('href', '/admin/support/case-1')
  })

  it('shows a ticket about the account with the way to fix it, and no money', async () => {
    const { operation: _operation, operationKind: _kind, operationId: _id, ...base } = detail
    api.on('GET', `${LIST}/{id}`, { ...base, category: 'IDENTITY', description: 'La INE lleva días en revisión' })
    render(`/admin/tickets/${ID}`)

    expect(await screen.findByText('Verificación de INE')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir la cuenta/ })).toHaveAttribute('href', '/admin/users/user-1')
    expect(screen.getByRole('link', { name: /Abrir Identidad/ })).toHaveAttribute('href', '/admin/identity')
    expect(screen.queryByRole('link', { name: /Abrir en Operaciones/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar saldo' })).not.toBeInTheDocument()
    expect(screen.queryByText('Monto')).not.toBeInTheDocument()
  })

  it('names the subject in the list when no operation is behind it', async () => {
    const { operationKind: _kind, operationId: _id, ...base } = ticket
    api.on('GET', LIST, { items: [{ ...base, category: 'ACCOUNT_ACCESS' }], page: 0, size: 20, hasNext: false, open: 1 })
    render()

    const row = (await screen.findByRole('link', { name: 'Ana López' })).closest('tr')!
    expect(within(row).getByText('Acceso a la cuenta')).toBeInTheDocument()
  })

  it('offers the adjustment on an operation, tied to the ticket, and lists what was recorded', async () => {
    api.on('GET', '/api/v1/admin/adjustments', {
      items: [{ id: 'adj-1', direction: 'CREDIT', amount: { amount: '250.00', currency: 'MXN' }, status: 'APPLIED' }],
      page: 0, size: 50, hasNext: false, pending: 0,
    })
    render(`/admin/tickets/${ID}`)

    expect(await screen.findByRole('link', { name: '+$250.00 MXN' })).toHaveAttribute('href', '/admin/adjustments/adj-1')
    expect(screen.getByRole('button', { name: 'Ajustar saldo' })).toBeInTheDocument()
    expect(api.callsTo('GET', '/api/v1/admin/adjustments')[0]!.query.get('ticketId')).toBe(ID)
  })

  it('looks a transfer up as a transfer, whichever side the customer was on', async () => {
    api.on('GET', `${LIST}/{id}`, { ...detail, operationKind: 'transfer_in', operation: { ...detail.operation, kind: 'transfer_in', status: 'COMPLETED' } })
    render(`/admin/tickets/${ID}`)

    expect(await screen.findByRole('link', { name: /Abrir en Operaciones/ })).toHaveAttribute('href', `/admin/operations?type=transfer&id=${DEPOSIT}`)
  })

  it('resolves it with what the customer will read', async () => {
    api.on('POST', `${LIST}/{id}/resolve`, { ...detail, status: 'RESOLVED', resolution: 'Acreditamos el depósito.', resolvedByName: 'Admin', resolvedAt: AT })
    render(`/admin/tickets/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como resuelto' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Resolución'), 'Acreditamos el depósito.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como resuelto' }))

    await waitFor(() => expect(api.callsTo('POST', `${LIST}/{id}/resolve`)[0]?.body).toEqual({ resolution: 'Acreditamos el depósito.' }))
    expect(await screen.findByText('Acreditamos el depósito.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como resuelto' })).not.toBeInTheDocument()
  })

  it('says when another administrator resolved it first', async () => {
    api.on('POST', `${LIST}/{id}/resolve`, problem(422, 'SUPPORT_TICKET_CLOSED'))
    render(`/admin/tickets/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como resuelto' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Resolución'), 'Listo')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como resuelto' }))

    expect(await within(dialog).findByText('Este ticket ya se resolvió.')).toBeInTheDocument()
  })
})
