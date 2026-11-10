import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { AdminIdentityPage } = await import('./AdminIdentityPage')

const ID = '11111111-2222-4333-8444-555555555555'
const LIST = '/api/v1/admin/identity-verifications'
const summary = {
  id: ID, userId: 'user-1', userEmail: 'juan@example.com', userName: 'Juan Gómez', status: 'PENDING_REVIEW',
  curpLastFour: 'RB02', namesMatchCurp: true, nameMatchesAccount: false, submittedAt: '2026-11-05T18:00:00Z',
}
const detail = {
  ...summary, accountName: 'Juan G.', firstNames: 'Juan', firstSurname: 'Gómez', secondSurname: 'Martínez',
  curp: 'GOMJ900515HDFMRB02', voterKey: 'GMMRJN90051509H123', cic: '123456789', citizenId: '987654321',
  expiryYear: 2031, birthDate: '1990-05-15', sex: 'H',
}

function render(route = '/admin/identity') {
  renderWithProviders(<AdminIdentityPage />, { route, path: '/admin/identity/:verificationId?' })
}

describe('AdminIdentityPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(testUser({ role: 'ADMIN' }))
    URL.createObjectURL = () => 'blob:photo'
    URL.revokeObjectURL = () => {}
    api.on('GET', LIST, { items: [summary], page: 0, size: 20, hasNext: false })
    api.on('GET', `${LIST}/{id}`, detail)
    api.on('GET', `${LIST}/{id}/images/{side}`, () => new Response(new Blob(['jpeg']), { headers: { 'Content-Type': 'image/jpeg' } }))
  })

  it('lists what waits for review first, with the automatic checks', async () => {
    render()

    const row = (await screen.findByRole('link', { name: 'Juan Gómez' })).closest('tr')!
    expect(within(row).getByText('Nombre y CURP coinciden')).toBeInTheDocument()
    expect(within(row).getByText('No coincide con la cuenta')).toBeInTheDocument()
    expect(api.callsTo('GET', LIST)[0]!.query.get('status')).toBe('PENDING_REVIEW')

    await userEvent.click(screen.getByRole('button', { name: 'Rechazada' }))
    await waitFor(() => expect(currentLocation()).toBe('/admin/identity?status=REJECTED'))
  })

  it('shows the card with its three photos and approves it after confirming', async () => {
    api.on('POST', `${LIST}/{id}/approve`, { ...detail, status: 'VERIFIED' })
    render(`/admin/identity/${ID}`)

    expect(await screen.findByText('GOMJ900515HDFMRB02')).toBeInTheDocument()
    expect(screen.getByText('Hombre')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(3))
    expect(api.callsTo('GET', `${LIST}/{id}/images/{side}`).map((c) => c.path.split('/').pop()).sort()).toEqual(['BACK', 'FRONT', 'SELFIE'])

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprobar' }))

    await waitFor(() => expect(api.callsTo('POST', `${LIST}/{id}/approve`)).toHaveLength(1))
  })

  it('rejects with the reason the customer will read', async () => {
    api.on('POST', `${LIST}/{id}/reject`, { ...detail, status: 'REJECTED' })
    render(`/admin/identity/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'La foto del reverso está borrosa')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }))

    await waitFor(() => expect(api.callsTo('POST', `${LIST}/{id}/reject`)[0]?.body).toEqual({ reason: 'La foto del reverso está borrosa' }))
  })

  it('offers no decision once it was reviewed', async () => {
    api.on('GET', `${LIST}/{id}`, { ...detail, status: 'VERIFIED', reviewedAt: '2026-11-06T10:00:00Z' })
    render(`/admin/identity/${ID}`)

    expect(await screen.findByText('GOMJ900515HDFMRB02')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
  })
})
