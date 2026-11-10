import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('sonner', () => ({ toast }))

const { SupportInboxPage } = await import('./SupportInboxPage')

const AGENT = '/api/v1/support/agent'
const AT = '2026-11-05T12:00:00Z'
const summary = { activeConversationId: 'case-1', queued: 2, queuedHighPriority: 1, available: true }
const theCase = {
  id: 'case-1', status: 'ASSIGNED', userName: 'Ana López', agentName: 'Laura Pérez', awaitsSurvey: false, createdAt: AT,
  priority: 'HIGH',
  messages: [
    { id: 'm1', sender: 'USER', text: '¿Cuánto tarda un SPEI?', asksFeedback: false, createdAt: AT },
    { id: 'm2', sender: 'AGENT', text: 'Llega en unos minutos.', asksFeedback: false, createdAt: AT },
    { id: 'm3', sender: 'SYSTEM', event: 'INACTIVITY_WARNING', asksFeedback: false, createdAt: AT },
  ],
}

function open(route = '/support/inbox') {
  return renderWithProviders(<SupportInboxPage />, { route, path: '/support/inbox/:conversationId?' })
}

const showTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))

beforeEach(() => {
  api.reset()
  vi.clearAllMocks()
  api.on('GET', `${AGENT}/summary`, summary)
  api.on('GET', `${AGENT}/metrics`, { days: 30, attended: 12, resolved: 10, firstResponseSeconds: 90, surveys: 4, averageScore: 4.56 })
  api.on('GET', `${AGENT}/conversations`, { items: [], page: 0, size: 20, hasNext: false })
  api.on('GET', `${AGENT}/conversations/{id}`, theCase)
  api.on('GET', `${AGENT}/conversations/{id}/customer`, { status: 'ACTIVE', emailVerified: true, identityStatus: 'VERIFIED', wallets: [] })
  api.on('GET', `${AGENT}/conversations/{id}/operations`, [])
  api.on('GET', `${AGENT}/conversations/{id}/tickets`, [])
  api.on('GET', `${AGENT}/conversations/{id}/history`, [])
  api.on('GET', `${AGENT}/conversations/{id}/notes`, [])
})

describe('the agent\'s toolbar', () => {
  it('shows the queue, flagging cases about money and a long wait', async () => {
    api.on('GET', `${AGENT}/summary`, { ...summary, oldestQueuedAt: new Date(Date.now() - 12 * 60_000).toISOString() })
    open()

    const queue = screen.getByLabelText('Estado de la fila')
    await waitFor(() => expect(within(queue).getByText('En fila').nextSibling).toHaveTextContent('2'))
    expect(within(queue).getByText('Urgentes').nextSibling).toHaveTextContent('1')
    expect(within(queue).getByText('Espera más larga').nextSibling).toHaveTextContent('12 min')
    expect(within(queue).getByTitle('Alguien lleva mucho esperando')).toBeInTheDocument()
  })

  it('shows the agent\'s numbers for the month while no case is open', async () => {
    open()

    const metrics = await screen.findByLabelText('Tu desempeño en los últimos 30 días')
    await waitFor(() => expect(within(metrics).getByText('Casos atendidos').nextSibling).toHaveTextContent('12'))
    expect(within(metrics).getByText('Primera respuesta').nextSibling).toHaveTextContent('2 min')
    expect(within(metrics).getByText('Calificación').nextSibling).toHaveTextContent('4.6 / 5')
    expect(api.callsTo('GET', `${AGENT}/metrics`)[0]!.query.get('days')).toBe('30')
  })

  it('pauses new cases and says so', async () => {
    api.on('PUT', `${AGENT}/availability`, { ...summary, available: false })
    open()

    await userEvent.click(await screen.findByRole('switch', { name: 'Disponible' }))

    await waitFor(() => expect(api.callsTo('PUT', `${AGENT}/availability`)[0]?.body).toEqual({ available: false }))
    expect(await screen.findByText('No te llegarán casos nuevos; puedes terminar el que tienes.')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'En pausa' })).not.toBeChecked()
    expect(toast.success).toHaveBeenCalledWith('Pausaste los casos nuevos.')
  })
})

describe('the case\'s details', () => {
  it('shows the customer\'s earlier cases and how they ended', async () => {
    api.on('GET', `${AGENT}/conversations/{id}/history`, [{
      id: 'cccccccc-0000-0000-0000-000000000009', status: 'RESOLVED', resolution: 'NO_REPLY', agentName: 'Mario Ruiz',
      lastText: 'Ya no me contestaron', createdAt: AT,
    }])
    open('/support/inbox/case-1')
    await showTab('Historial')

    expect(await screen.findByText('Ya no me contestaron')).toBeInTheDocument()
    expect(screen.getByText('Sin respuesta del cliente')).toBeInTheDocument()
    expect(screen.getByText('Lo atendió Mario Ruiz')).toBeInTheDocument()
  })

  it('says when it is the customer\'s first case', async () => {
    open('/support/inbox/case-1')
    await showTab('Historial')

    expect(await screen.findByText('Es su primer caso con una persona.')).toBeInTheDocument()
  })

  it('adds a note for the team', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/notes`, json(201, [{ id: 'n1', authorName: 'Laura Pérez', text: 'Revisé el SPEI', createdAt: AT }]))
    open('/support/inbox/case-1')
    await showTab('Notas')
    expect(await screen.findByText('Aún no hay notas en este caso.')).toBeInTheDocument()

    const field = screen.getByRole('textbox', { name: 'Nueva nota' })
    await userEvent.type(field, '  Revisé el SPEI ')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar nota' }))

    expect(await screen.findByText('Revisé el SPEI')).toBeInTheDocument()
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/notes`)[0]!.body).toEqual({ text: 'Revisé el SPEI' })
    expect(field).toHaveValue('')
  })

  it('starts on the customer\'s account while open, and leaves it out once closed', async () => {
    api.on('GET', `${AGENT}/conversations/{id}`, { ...theCase, status: 'RESOLVED', resolution: 'SOLVED' })
    open('/support/inbox/case-1')

    expect(await screen.findByRole('tab', { name: 'Operaciones' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Cliente' })).not.toBeInTheDocument()
  })
})

describe('a closed case', () => {
  const closed = {
    ...theCase, status: 'RESOLVED', resolution: 'INFORMATION', priority: 'NORMAL', escalatedAt: AT, assignedAt: AT,
    resolvedAt: '2026-11-05T12:30:00Z',
  }

  it('says how it ended, badging neither a normal priority nor a wait that never was', async () => {
    api.on('GET', `${AGENT}/conversations`, { items: [{ ...closed, lastText: 'ok', lastMessageAt: AT }], page: 0, size: 20, hasNext: false })
    api.on('GET', `${AGENT}/conversations/{id}`, closed)
    const { unmount } = open()

    const row = await screen.findByRole('link', { name: /Ana López/ })
    expect(row).toHaveAttribute('href', '/support/inbox/case-1')
    expect(within(row).getByText('Solo información')).toBeInTheDocument()
    expect(within(row).queryByText('—')).not.toBeInTheDocument()
    unmount()

    open('/support/inbox/case-1')
    const header = (await screen.findByRole('heading', { name: 'Ana López' })).parentElement as HTMLElement
    expect(within(header).getByText('Solo información')).toBeInTheDocument()
    expect(within(header).getByText(/^· Se cerró/)).toBeInTheDocument()
    expect(within(header).queryByText(/Esperó/)).not.toBeInTheDocument()
    expect(within(header).queryByText('—')).not.toBeInTheDocument()
  })

  it('still flags an urgent one', async () => {
    api.on('GET', `${AGENT}/conversations`, { items: [{ ...closed, priority: 'HIGH', lastMessageAt: AT }], page: 0, size: 20, hasNext: false })
    open()

    expect(within(await screen.findByRole('link', { name: /Ana López/ })).getByText('Urgente')).toBeInTheDocument()
  })
})

describe('the inbox and a case, each on its own page', () => {
  it('lists the cases without a case open, and opens one apart with the way back', async () => {
    api.on('GET', `${AGENT}/conversations`, { items: [{ ...theCase, lastText: 'Hola', lastMessageAt: AT }], page: 0, size: 20, hasNext: false })
    const { unmount } = open()

    expect(await screen.findByRole('link', { name: /Ana López/ })).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    unmount()

    open('/support/inbox/case-1')
    expect(await screen.findByRole('log')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la bandeja' })).toHaveAttribute('href', '/support/inbox')
    expect(screen.queryByRole('textbox', { name: 'Buscar casos' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Estado de la fila')).not.toBeInTheDocument()
  })
})

describe('the case\'s thread', () => {
  it('shows the warning the customer got for not answering', async () => {
    open('/support/inbox/case-1')

    const thread = await screen.findByRole('log')
    expect(within(thread).getByText(/cerraremos esta conversación pronto/)).toBeInTheDocument()
  })
})

describe('teaching the assistant', () => {
  it('proposes the last question and answer, which the agent can change', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/bot-suggestions`, json(201, { id: 's1', status: 'OPEN' }))
    open('/support/inbox/case-1')

    await userEvent.click(await screen.findByRole('button', { name: 'Enseñar al asistente' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: 'Pregunta del cliente' })).toHaveValue('¿Cuánto tarda un SPEI?')
    const answer = within(dialog).getByRole('textbox', { name: 'Respuesta' })
    expect(answer).toHaveValue('Llega en unos minutos.')
    await userEvent.type(answer, ' Si no, revisa la CLABE.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar sugerencia' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/bot-suggestions`)[0]!.body).toEqual({
      question: '¿Cuánto tarda un SPEI?', answer: 'Llega en unos minutos. Si no, revisa la CLABE.',
    })
    expect(toast.success).toHaveBeenCalledWith('Enviamos tu sugerencia a administración.')
  })
})
