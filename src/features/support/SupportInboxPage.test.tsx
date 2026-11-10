import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
const { SupportInboxPage } = await import('./SupportInboxPage')

const AGENT = '/api/v1/support/agent'
const AT = '2026-11-05T12:00:00Z'
const summaryRow = { id: 'case-1', status: 'ASSIGNED', userName: 'Ana López', lastText: 'No me llegó el retiro', lastMessageAt: AT, createdAt: AT }
const theCase = (status = 'ASSIGNED') => ({
  id: 'case-1', status, userName: 'Ana López', agentName: 'Laura Pérez', awaitsSurvey: false, createdAt: AT,
  messages: [
    { id: 'm1', sender: 'USER', text: '¿Cómo retiro?', asksFeedback: false, createdAt: AT },
    { id: 'm2', sender: 'BOT', text: 'Elige **Retirar**.', asksFeedback: true, createdAt: AT },
    { id: 'm3', sender: 'SYSTEM', event: 'ASSIGNED', asksFeedback: false, createdAt: AT },
  ],
})

const deposit = { kind: 'deposit', id: 'aaaaaaaa-0000-0000-0000-000000000001', status: 'PENDING', amount: { amount: '250.00', currency: 'MXN' }, createdAt: AT }
const withdrawal = {
  kind: 'withdrawal', id: 'bbbbbbbb-0000-0000-0000-000000000002', status: 'FAILED', amount: { amount: '75.00', currency: 'MXN' },
  reason: 'Bank rejected the CLABE', createdAt: AT, closedAt: '2026-11-05T13:00:00Z',
}
const ticketOn = (operation: typeof deposit, status = 'OPEN') => ({
  id: 't-1', conversationId: 'case-1', status, operationKind: operation.kind, operationId: operation.id,
  description: 'El cliente pagó y no llegó', openedByName: 'Laura Pérez', createdAt: AT,
})

function open(route = '/support/inbox') {
  return renderWithProviders(<SupportInboxPage />, { route, path: '/support/inbox/:conversationId?' })
}

// The case's details show one panel at a time; an open case starts on the customer's account
async function showTab(name: string) {
  await userEvent.click(await screen.findByRole('tab', { name }))
}

describe('SupportInboxPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', `${AGENT}/summary`, { activeConversationId: 'case-1', queued: 3 })
    api.on('GET', `${AGENT}/conversations`, { items: [summaryRow], page: 0, size: 20, hasNext: false })
    api.on('GET', `${AGENT}/conversations/{id}`, theCase())
    api.on('GET', `${AGENT}/conversations/{id}/operations`, [deposit, withdrawal])
    api.on('GET', `${AGENT}/conversations/{id}/tickets`, [])
    api.on('GET', `${AGENT}/conversations/{id}/customer`, { status: 'ACTIVE', emailVerified: true, identityStatus: 'VERIFIED', wallets: [] })
  })

  it('lists the cases and says how many people wait', async () => {
    open()

    expect(await screen.findByRole('link', { name: /Ana López/ })).toHaveAttribute('href', '/support/inbox/case-1')
    expect(await screen.findByText('3 personas esperan en la fila.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir mi caso activo' })).toHaveAttribute('href', '/support/inbox/case-1')
  })

  it('explains an empty inbox', async () => {
    api.on('GET', `${AGENT}/summary`, { queued: 0 })
    api.on('GET', `${AGENT}/conversations`, { items: [], page: 0, size: 20, hasNext: false })
    open()

    expect(await screen.findByText('Aún no tienes casos')).toBeInTheDocument()
  })

  it('opens a case with everything said to the bot', async () => {
    open('/support/inbox/case-1')

    const thread = await screen.findByRole('log')
    expect(within(thread).getByText('¿Cómo retiro?')).toBeInTheDocument()
    expect(within(thread).getByText('Retirar').tagName).toBe('STRONG')
    expect(within(thread).getByText('Una persona de soporte se unió a la conversación.')).toBeInTheDocument()
    expect(within(thread).getByText(/^Asistente/)).toBeInTheDocument()
    // Already on the active case: no link to itself
    expect(screen.queryByRole('link', { name: 'Abrir mi caso activo' })).not.toBeInTheDocument()
  })

  it('replies', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/messages`, {
      ...theCase(), messages: [...theCase().messages, { id: 'm4', sender: 'AGENT', text: 'Ya lo reviso', asksFeedback: false, createdAt: AT }],
    })
    open('/support/inbox/case-1')

    await userEvent.type(await screen.findByRole('textbox', { name: 'Mensaje' }), 'Ya lo reviso{Enter}')

    expect(await within(screen.getByRole('log')).findByText('Ya lo reviso')).toBeInTheDocument()
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/messages`)[0]!.body).toEqual({ text: 'Ya lo reviso' })
  })

  it('resolves the case, after which nothing more can be written', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/resolve`, theCase('RESOLVED'))
    open('/support/inbox/case-1')

    await userEvent.click(await screen.findByRole('button', { name: 'Resolver caso' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Solo información' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar caso' }))

    expect(await screen.findByText('Este caso ya se cerró.')).toBeInTheDocument()
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/resolve`)[0]!.body).toEqual({ reason: 'INFORMATION' })
    expect(screen.queryByRole('textbox', { name: 'Mensaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolver caso' })).not.toBeInTheDocument()
  })

  it('says so when the case is not theirs', async () => {
    api.on('GET', `${AGENT}/conversations/{id}`, problem(404, 'SUPPORT_CONVERSATION_NOT_FOUND'))
    open('/support/inbox/case-2')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se encontró la conversación.'))
  })
})

describe('the customer\'s operations, for the agent attending them', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', `${AGENT}/summary`, { activeConversationId: 'case-1', queued: 0 })
    api.on('GET', `${AGENT}/conversations`, { items: [summaryRow], page: 0, size: 20, hasNext: false })
    api.on('GET', `${AGENT}/conversations/{id}`, theCase())
    api.on('GET', `${AGENT}/conversations/{id}/operations`, [deposit, withdrawal])
    api.on('GET', `${AGENT}/conversations/{id}/tickets`, [])
    api.on('GET', `${AGENT}/conversations/{id}/customer`, { status: 'ACTIVE', emailVerified: true, identityStatus: 'VERIFIED', wallets: [] })
  })

  it('lists them read only, with status, amount and why one failed', async () => {
    open('/support/inbox/case-1')
    await showTab('Operaciones')

    const panel = (await screen.findByText('Operaciones del cliente')).closest('[data-slot="card"]') as HTMLElement
    expect(await within(panel).findByText('Depósito')).toBeInTheDocument()
    expect(within(panel).getByText('$250.00')).toBeInTheDocument()
    expect(within(panel).getByText('Fallido')).toBeInTheDocument()
    expect(within(panel).getByText('Motivo: Bank rejected the CLABE')).toBeInTheDocument()
    expect(within(panel).getByText(/soporte no mueve dinero/)).toBeInTheDocument()
  })

  it('escalates one to the administrators with what happened', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/tickets`, () => {
      api.on('GET', `${AGENT}/conversations/{id}/tickets`, [ticketOn(deposit)])
      return json(201, ticketOn(deposit))
    })
    open('/support/inbox/case-1')
    await showTab('Operaciones')

    await userEvent.click(await screen.findByRole('button', { name: /^Escalar Depósito aaaaaaaa/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Descripción' }), 'El cliente pagó y no llegó')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escalar' }))

    await waitFor(() => expect(api.callsTo('POST', `${AGENT}/conversations/{id}/tickets`)[0]?.body)
      .toEqual({ operationId: deposit.id, description: 'El cliente pagó y no llegó' }))
    // Already with the administrators: it can't be escalated twice, and the case shows it
    expect(await screen.findByText('Escalados de este caso')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Escalar Depósito/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Escalar Retiro/ })).toBeInTheDocument()
  })

  it('explains when the operation is already under review', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/tickets`, problem(409, 'SUPPORT_TICKET_ALREADY_OPEN'))
    open('/support/inbox/case-1')
    await showTab('Operaciones')

    await userEvent.click(await screen.findByRole('button', { name: /^Escalar Retiro/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Descripción' }), 'No le llegó')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escalar' }))

    expect(await within(dialog).findByText('Esto ya está en revisión con administración.')).toBeInTheDocument()
  })

  it('keeps showing what was escalated once the case closes, but not the operations', async () => {
    api.on('GET', `${AGENT}/conversations/{id}`, theCase('RESOLVED'))
    api.on('GET', `${AGENT}/conversations/{id}/tickets`, [{ ...ticketOn(deposit, 'RESOLVED'), resolution: 'Acreditamos el depósito.' }])
    open('/support/inbox/case-1')

    expect(await screen.findByText('Resolución: Acreditamos el depósito.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Escalar/ })).not.toBeInTheDocument()
    expect(api.callsTo('GET', `${AGENT}/conversations/{id}/operations`)).toHaveLength(0)
  })
})

describe('a ticket waiting for an administrator', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', `${AGENT}/summary`, { activeConversationId: 'case-1', queued: 0 })
    api.on('GET', `${AGENT}/conversations`, { items: [summaryRow], page: 0, size: 20, hasNext: false })
    api.on('GET', `${AGENT}/conversations/{id}`, theCase())
    api.on('GET', `${AGENT}/conversations/{id}/operations`, [deposit])
    api.on('GET', `${AGENT}/conversations/{id}/tickets`, [ticketOn(deposit)])
    api.on('GET', `${AGENT}/conversations/{id}/customer`, { status: 'ACTIVE', emailVerified: true, identityStatus: 'VERIFIED', wallets: [] })
  })

  it('shows its resolution as soon as it arrives, without reloading', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      open('/support/inbox/case-1')
      await showTab('Operaciones')
      expect(await screen.findByText('El cliente pagó y no llegó')).toBeInTheDocument()

      api.on('GET', `${AGENT}/conversations/{id}/tickets`, [{ ...ticketOn(deposit, 'RESOLVED'), resolution: 'Acreditamos el depósito.' }])
      await vi.advanceTimersByTimeAsync(10_000)

      expect(await screen.findByText('Resolución: Acreditamos el depósito.')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
