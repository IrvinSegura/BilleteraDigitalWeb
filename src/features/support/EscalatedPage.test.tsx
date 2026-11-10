import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
const { EscalatedPage } = await import('./EscalatedPage')

const MINE = '/api/v1/support/agent/tickets'
const AT = '2026-11-05T12:00:00Z'
const waiting = {
  id: 't-1', conversationId: 'aaaaaaaa-0000-0000-0000-000000000001', status: 'OPEN', category: 'OPERATION',
  operationKind: 'deposit', operationId: 'bbbbbbbb-0000-0000-0000-000000000002', description: 'El cliente pagó y no llegó',
  customerName: 'Ana López', openedByName: 'Laura Pérez', createdAt: AT,
}
const settled = {
  ...waiting, id: 't-2', status: 'RESOLVED', category: 'IDENTITY', operationKind: undefined, operationId: undefined,
  description: 'Su INE lleva días en revisión', resolution: 'Verificamos su INE.', resolvedByName: 'Admin Uno', resolvedAt: AT,
}
const lastCall = () => api.callsTo('GET', MINE).at(-1)!

function open() {
  return renderWithProviders(<EscalatedPage />, { route: '/support/escalated' })
}

describe('EscalatedPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', MINE, (call) => ({
      items: call.query.get('status') === 'OPEN' ? [waiting] : call.query.get('status') === 'RESOLVED' ? [settled] : [waiting, settled],
      page: 0, size: 20, hasNext: false, open: 1,
    }))
  })

  it('starts on what still waits, with what it is about, for whom and a way back to the case', async () => {
    open()

    const item = (await screen.findByText('El cliente pagó y no llegó')).closest('li') as HTMLElement
    expect(within(item).getByText('Depósito')).toBeInTheDocument()
    expect(within(item).getByText('En revisión')).toBeInTheDocument()
    expect(within(item).getByText(/Cliente: Ana López/)).toBeInTheDocument()
    expect(within(item).getByRole('link', { name: /Ver caso aaaaaaaa/ })).toHaveAttribute('href', `/support/inbox/${waiting.conversationId}`)
    expect(screen.getByText(/1 escalado espera a administración\./)).toBeInTheDocument()
    expect(lastCall().query.get('status')).toBe('OPEN')
  })

  it('shows how the administrators settled the rest', async () => {
    open()
    await screen.findByText('El cliente pagó y no llegó')

    await userEvent.click(screen.getByRole('button', { name: 'Resueltos' }))

    await waitFor(() => expect(lastCall().query.get('status')).toBe('RESOLVED'))
    const item = (await screen.findByText('Verificamos su INE.')).closest('li') as HTMLElement
    expect(within(item).getByText('Verificación de INE')).toBeInTheDocument()
    expect(within(item).getByText('Lo que hizo administración')).toBeInTheDocument()
    expect(within(item).getByText(/^Resolvió Admin Uno/)).toBeInTheDocument()
  })

  it('says when nothing waits', async () => {
    api.on('GET', MINE, { items: [], page: 0, size: 20, hasNext: false, open: 0 })
    open()

    expect(await screen.findByText('Nada pendiente')).toBeInTheDocument()
    expect(screen.getByText(/No tienes escalados pendientes\./)).toBeInTheDocument()
  })
})
