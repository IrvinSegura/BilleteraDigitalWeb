import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ state: { status: 'signed-out' }, logout: vi.fn() }) }))

const { AdminSupportPage } = await import('./AdminSupportPage')

const AT = '2026-11-05T12:00:00Z'
const LIST = '/api/v1/admin/support/conversations'
const row = { id: 'case-1', status: 'RESOLVED', userName: 'Ana López', agentName: 'Laura Pérez', lastText: 'Gracias', lastMessageAt: AT, createdAt: AT }
const lastList = () => api.calls.filter((c) => c.path === LIST).at(-1)!

function open(route = '/admin/support') {
  return renderWithProviders(<AdminSupportPage />, { route, path: '/admin/support/:conversationId?' })
}

describe('AdminSupportPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', '/api/v1/admin/support/summary', { withBot: 4, queued: 2, assigned: 1, resolved: 9, surveys: 6, averageScore: 4.3333 })
    api.on('GET', LIST, { items: [row], page: 0, size: 20, hasNext: false })
  })

  it('shows how support is doing, with the average rounded', async () => {
    open()
    const stats = screen.getByLabelText('Resumen de soporte')

    await waitFor(() => expect(within(stats).getByText('En fila').nextSibling).toHaveTextContent('2'))
    expect(within(stats).getByText('Calificación').nextSibling).toHaveTextContent('4.3')
    expect(within(stats).getByText('Encuestas').nextSibling).toHaveTextContent('6')
  })

  it('lists the cases, each linking to its detail, and filters them by status', async () => {
    open()

    expect(await screen.findByRole('link', { name: 'Ana López' })).toHaveAttribute('href', '/admin/support/case-1')
    await userEvent.click(screen.getByRole('button', { name: 'En fila' }))

    await waitFor(() => expect(lastList().query.get('status')).toBe('QUEUED'))
    expect(currentLocation()).toBe('/admin/support?status=QUEUED')
  })

  it('shows a case with its survey, read-only', async () => {
    api.on('GET', `${LIST}/{id}`, {
      surveyScore: 5,
      surveyComment: 'Muy rápido',
      conversation: {
        id: 'case-1', status: 'RESOLVED', userName: 'Ana López', agentName: 'Laura Pérez', awaitsSurvey: false, createdAt: AT,
        messages: [{ id: 'm1', sender: 'USER', text: 'Hola', asksFeedback: false, createdAt: AT }],
      },
    })
    open('/admin/support/case-1')

    expect(await screen.findByText('5 de 5')).toBeInTheDocument()
    expect(screen.getByText('“Muy rápido”')).toBeInTheDocument()
    expect(screen.getByText('Atendido por Laura Pérez')).toBeInTheDocument()
    expect(within(screen.getByRole('log')).getByText('Hola')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('says when a case has no rating', async () => {
    api.on('GET', `${LIST}/{id}`, {
      conversation: { id: 'case-1', status: 'QUEUED', userName: 'Ana López', awaitsSurvey: false, createdAt: AT, messages: [] },
    })
    open('/admin/support/case-1')

    expect(await screen.findByText('Sin calificar')).toBeInTheDocument()
    expect(screen.getByText('Sin agente asignado')).toBeInTheDocument()
  })

  describe('assistant report', () => {
    const MISSES = '/api/v1/admin/support/bot/misses'
    const lastMisses = () => api.calls.filter((c) => c.path === MISSES).at(-1)!
    const SUGGESTIONS = '/api/v1/admin/support/bot/suggestions'
    const suggestion = {
      id: 's1', conversationId: 'conv-3', agentName: 'Laura Pérez', language: 'es', question: '¿Cuánto tarda un SPEI?',
      answer: 'Llega en unos minutos.', status: 'OPEN', createdAt: AT,
    }
    const miss = {
      kind: 'NOT_HELPED', language: 'es', question: 'no me llega mi retiro', topics: ['¿Cuánto tarda un retiro?'],
      times: 3, lastAskedAt: AT, conversationId: 'conv-9',
    }

    beforeEach(() => {
      api.on('GET', '/api/v1/admin/support/bot/summary', {
        questions: 40, answered: 25, helped: 10, notHelped: 4, notFound: 6, suggested: 5, askedAgain: 2, passedOn: 2,
      })
      api.on('GET', MISSES, { items: [miss], page: 0, size: 20, hasNext: false })
      api.on('GET', SUGGESTIONS, { items: [], page: 0, size: 20, hasNext: false, open: 0 })
    })

    it('opens from the view switch and keeps it in the address', async () => {
      open()

      await userEvent.click(screen.getByRole('button', { name: 'Asistente' }))

      expect(currentLocation()).toBe('/admin/support?view=bot')
      expect(await screen.findByText('no me llega mi retiro')).toBeInTheDocument()
    })

    it('shows what the assistant did and the questions it failed, each with its conversation', async () => {
      open('/admin/support?view=bot')
      const stats = screen.getByLabelText('Resumen del asistente')

      await waitFor(() => expect(within(stats).getByText('Preguntas').nextSibling).toHaveTextContent('40'))
      expect(within(stats).getAllByText('No le sirvió')[0].nextSibling).toHaveTextContent('4')
      expect(await screen.findByText('Contestó: ¿Cuánto tarda un retiro?')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver conversación' })).toHaveAttribute('href', '/admin/support/conv-9')
      expect(lastMisses().query.get('days')).toBe('30')
      expect(lastMisses().query.has('kind')).toBe(false)
    })

    it('filters by kind, language and period', async () => {
      open('/admin/support?view=bot')
      await screen.findByText('no me llega mi retiro')

      await userEvent.click(screen.getByRole('button', { name: 'No supo' }))
      await waitFor(() => expect(lastMisses().query.get('kind')).toBe('NOT_FOUND'))
      await userEvent.click(screen.getByRole('button', { name: 'Inglés' }))
      await waitFor(() => expect(lastMisses().query.get('language')).toBe('en'))
      await userEvent.click(screen.getByRole('button', { name: '7 días' }))

      await waitFor(() => expect(lastMisses().query.get('days')).toBe('7'))
      expect(currentLocation()).toBe('/admin/support?view=bot&kind=NOT_FOUND&language=en&days=7')
    })

    it('lists what agents suggest the assistant learn, and marks one added', async () => {
      api.on('GET', SUGGESTIONS, { items: [suggestion], page: 0, size: 20, hasNext: false, open: 1 })
      api.on('POST', `${SUGGESTIONS}/{id}/review`, () => {
        api.on('GET', SUGGESTIONS, { items: [], page: 0, size: 20, hasNext: false, open: 0 })
        return { ...suggestion, status: 'ADDED', reviewedByName: 'Admin' }
      })
      open('/admin/support?view=bot')

      const card = (await screen.findByText('¿Cuánto tarda un SPEI?')).closest('li') as HTMLElement
      expect(within(card).getByText('Llega en unos minutos.')).toBeInTheDocument()
      expect(within(card).getByText('Propuso Laura Pérez · ES')).toBeInTheDocument()
      expect(within(card).getByRole('link', { name: 'Ver conversación' })).toHaveAttribute('href', '/admin/support/conv-3')
      expect(api.callsTo('GET', SUGGESTIONS)[0]!.query.get('status')).toBe('OPEN')
      await userEvent.click(within(card).getByRole('button', { name: 'Ya la agregué' }))

      await waitFor(() => expect(api.callsTo('POST', `${SUGGESTIONS}/{id}/review`)[0]?.body).toEqual({ status: 'ADDED' }))
      expect(await screen.findByText('Sin sugerencias')).toBeInTheDocument()
    })

    it('says when there is nothing to fix', async () => {
      api.on('GET', MISSES, { items: [], page: 0, size: 20, hasNext: false })
      open('/admin/support?view=bot')

      expect(await screen.findByText('Sin preguntas fallidas')).toBeInTheDocument()
    })
  })

  it('shows the team\'s notes on a case and how it ended', async () => {
    api.on('GET', `${LIST}/{id}`, {
      conversation: { id: 'case-1', status: 'RESOLVED', resolution: 'TICKET', userName: 'Ana López', agentName: 'Laura Pérez', awaitsSurvey: false, createdAt: AT, messages: [] },
      notes: [{ id: 'n1', authorName: 'Laura Pérez', text: 'Lo pasé a administración', createdAt: AT }],
    })
    open('/admin/support/case-1')

    expect(await screen.findByText('Lo pasé a administración')).toBeInTheDocument()
    expect(screen.getByText('Escalado a administración')).toBeInTheDocument()
  })

  describe('team report', () => {
    const AGENTS = '/api/v1/admin/support/agents'
    const metrics = { days: 30, attended: 12, resolved: 10, firstResponseSeconds: 90, handleSeconds: 600, surveys: 4, averageScore: 4.5 }

    beforeEach(() => {
      api.on('GET', AGENTS, [
        { id: 'a1', name: 'Laura Pérez', busy: true, available: true, metrics },
        { id: 'a2', name: 'Mario Ruiz', busy: false, available: false, metrics: { days: 30, attended: 0, resolved: 0, surveys: 0 } },
        { id: 'a3', name: 'Sofía Gil', busy: false, available: true, metrics: { days: 30, attended: 1, resolved: 1, surveys: 0 } },
      ])
    })

    it('shows who attends, who is free or paused, and how each did', async () => {
      open('/admin/support?view=team')

      const laura = (await screen.findByRole('cell', { name: 'Laura Pérez' })).closest('tr') as HTMLElement
      expect(within(laura).getByText('Atendiendo')).toBeInTheDocument()
      expect(within(laura).getByText('2 min')).toBeInTheDocument()
      expect(within(laura).getByText('10 min')).toBeInTheDocument()
      expect(within(laura).getByText('4.5 (4)')).toBeInTheDocument()
      const mario = screen.getByRole('cell', { name: 'Mario Ruiz' }).closest('tr') as HTMLElement
      expect(within(mario).getByText('En pausa')).toBeInTheDocument()
      // No times nor rating without cases
      expect(within(mario).getAllByText('—')).toHaveLength(3)
      const stats = screen.getByLabelText('Desempeño del equipo')
      expect(within(stats).getByText('Libre').nextSibling).toHaveTextContent('1')
      expect(within(stats).getByText('En pausa').nextSibling).toHaveTextContent('1')
    })

    it('reads another period', async () => {
      open('/admin/support?view=team')
      await screen.findByRole('cell', { name: 'Laura Pérez' })

      await userEvent.click(screen.getByRole('button', { name: '7 días' }))

      await waitFor(() => expect(api.callsTo('GET', AGENTS).at(-1)!.query.get('days')).toBe('7'))
      expect(currentLocation()).toBe('/admin/support?view=team&days=7')
    })
  })
})
