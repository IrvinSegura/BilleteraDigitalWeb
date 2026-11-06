import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { problem, stubApi } from '@/test/api'
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

function open(route = '/support/inbox') {
  return renderWithProviders(<SupportInboxPage />, { route, path: '/support/inbox/:conversationId?' })
}

describe('SupportInboxPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', `${AGENT}/summary`, { activeConversationId: 'case-1', queued: 3 })
    api.on('GET', `${AGENT}/conversations`, { items: [summaryRow], page: 0, size: 20, hasNext: false })
    api.on('GET', `${AGENT}/conversations/{id}`, theCase())
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

    expect(await screen.findByText('Este caso ya se cerró.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Mensaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolver caso' })).not.toBeInTheDocument()
  })

  it('says so when the case is not theirs', async () => {
    api.on('GET', `${AGENT}/conversations/{id}`, problem(404, 'SUPPORT_CONVERSATION_NOT_FOUND'))
    open('/support/inbox/case-2')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se encontró la conversación.'))
  })
})
