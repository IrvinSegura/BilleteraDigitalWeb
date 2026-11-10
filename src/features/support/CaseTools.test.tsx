import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { SupportInboxPage } = await import('./SupportInboxPage')

const AGENT = '/api/v1/support/agent'
const AT = '2026-11-05T12:00:00Z'
const theCase = {
  id: 'case-1', status: 'ASSIGNED', userName: 'Ana López', agentName: 'Laura', createdAt: AT, awaitsSurvey: false,
  messages: [{ id: 'm1', sender: 'USER', text: '¿Por qué no puedo retirar?', asksFeedback: false, createdAt: AT }],
}
const standing = {
  status: 'ACTIVE', emailVerified: true, identityStatus: 'PENDING_REVIEW', identitySubmittedAt: AT,
  identityRequiredForWithdrawals: true, memberSince: AT, wallets: [{ currency: 'MXN', frozen: false }, { currency: 'USD', frozen: true }],
}

function open() {
  return renderWithProviders(<SupportInboxPage />, { route: '/support/inbox/case-1', path: '/support/inbox/:conversationId?' })
}

const panel = async (title: string) => (await screen.findByText(title)).closest('[data-slot="card"]') as HTMLElement

beforeEach(() => {
  api.reset()
  api.on('GET', `${AGENT}/summary`, { activeConversationId: 'case-1', queued: 0 })
  api.on('GET', `${AGENT}/conversations`, { items: [], page: 0, size: 20, hasNext: false })
  api.on('GET', `${AGENT}/conversations/{id}`, theCase)
  api.on('GET', `${AGENT}/conversations/{id}/operations`, [])
  api.on('GET', `${AGENT}/conversations/{id}/tickets`, [])
  api.on('GET', `${AGENT}/conversations/{id}/customer`, standing)
})

describe('where the customer\'s account stands', () => {
  it('answers why they cannot withdraw', async () => {
    open()

    const card = await panel('Cuenta del cliente')
    expect(await within(card).findByText('No puede retirar hasta que su INE esté verificada.')).toBeInTheDocument()
    expect(within(card).getByText('En revisión')).toBeInTheDocument()
    expect(within(card).getByText('USD congelada')).toBeInTheDocument()
    expect(within(card).getByText('MXN activa')).toBeInTheDocument()
  })

  it('calls an INE never sent the way the screens do', async () => {
    api.on('GET', `${AGENT}/conversations/{id}/customer`, { ...standing, identityStatus: 'NONE', identitySubmittedAt: undefined })
    open()

    const card = await panel('Cuenta del cliente')
    expect(await within(card).findByText('Sin verificar')).toBeInTheDocument()
    expect(within(card).getByText(/No puede retirar/)).toBeInTheDocument()
  })

  it('does not warn about what does not block them', async () => {
    api.on('GET', `${AGENT}/conversations/{id}/customer`, { ...standing, identityStatus: 'VERIFIED' })
    open()

    const card = await panel('Cuenta del cliente')
    expect(await within(card).findByText('Verificada')).toBeInTheDocument()
    expect(within(card).queryByText(/No puede retirar/)).not.toBeInTheDocument()
  })

  it('shows a sign-in lock and why the INE was rejected', async () => {
    api.on('GET', `${AGENT}/conversations/{id}/customer`, {
      ...standing, identityStatus: 'REJECTED', identityRejectionReason: 'Foto borrosa', lockedUntil: '2026-11-05T13:00:00Z',
    })
    open()

    const card = await panel('Cuenta del cliente')
    expect(await within(card).findByText('Motivo del rechazo: Foto borrosa')).toBeInTheDocument()
    expect(within(card).getByText(/Inicio de sesión bloqueado hasta/)).toBeInTheDocument()
  })

  it('is not asked for once the case closes', async () => {
    api.on('GET', `${AGENT}/conversations/{id}`, { ...theCase, status: 'RESOLVED' })
    open()

    expect(await screen.findByText('Este caso ya se cerró.')).toBeInTheDocument()
    expect(screen.queryByText('Cuenta del cliente')).not.toBeInTheDocument()
    expect(api.callsTo('GET', `${AGENT}/conversations/{id}/customer`)).toHaveLength(0)
  })
})

describe('escalating what is not about money', () => {
  it('sends the subject, with no operation', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/tickets`, () => {
      const ticket = { id: 't-1', conversationId: 'case-1', status: 'OPEN', category: 'IDENTITY', description: 'Lleva días en revisión', createdAt: AT }
      api.on('GET', `${AGENT}/conversations/{id}/tickets`, [ticket])
      return json(201, ticket)
    })
    open()
    await userEvent.click(await screen.findByRole('tab', { name: 'Operaciones' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Escalar otro problema' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Escalar un problema de la cuenta')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Asunto' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Verificación de INE' }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Descripción' }), 'Lleva días en revisión')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escalar' }))

    await waitFor(() => expect(api.callsTo('POST', `${AGENT}/conversations/{id}/tickets`)[0]?.body)
      .toEqual({ category: 'IDENTITY', description: 'Lleva días en revisión' }))
    const card = await panel('Operaciones del cliente')
    expect(await within(card).findByText('Verificación de INE')).toBeInTheDocument()
  })

  it('explains when that subject is already with the administrators', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/tickets`, problem(409, 'SUPPORT_TICKET_ALREADY_OPEN'))
    open()
    await userEvent.click(await screen.findByRole('tab', { name: 'Operaciones' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Escalar otro problema' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Descripción' }), 'Cuenta bloqueada')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Escalar' }))

    expect(await within(dialog).findByText('Esto ya está en revisión con administración.')).toBeInTheDocument()
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/tickets`)[0]!.body).toMatchObject({ category: 'ACCOUNT_ACCESS' })
  })
})

describe('handing the case over', () => {
  it('returns it to the queue, after asking, and goes back to the inbox', async () => {
    api.on('POST', `${AGENT}/conversations/{id}/release`, json(204))
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Devolver a la fila' }))
    const dialog = await screen.findByRole('dialog')
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/release`)).toHaveLength(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Devolver a la fila' }))

    await waitFor(() => expect(currentLocation()).toBe('/support/inbox'))
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/release`)).toHaveLength(1)
  })

  it('passes it to a free colleague, never a busy one', async () => {
    api.on('GET', `${AGENT}/colleagues`, [{ id: 'free-1', name: 'Mario Ruiz', busy: false }, { id: 'busy-1', name: 'Sofía Gil', busy: true }])
    api.on('POST', `${AGENT}/conversations/{id}/transfer`, json(204))
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a un colega' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('button', { name: 'Pasar el caso a Sofía Gil' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pasar el caso a Mario Ruiz' }))

    await waitFor(() => expect(currentLocation()).toBe('/support/inbox'))
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/transfer`)[0]!.body).toEqual({ agentId: 'free-1' })
  })

  it('stays on the case when the colleague was just taken', async () => {
    api.on('GET', `${AGENT}/colleagues`, [{ id: 'free-1', name: 'Mario Ruiz', busy: false }])
    api.on('POST', `${AGENT}/conversations/{id}/transfer`, problem(409, 'SUPPORT_AGENT_NOT_AVAILABLE'))
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a un colega' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Pasar el caso a Mario Ruiz' }))

    expect(await within(dialog).findByText(/Esa persona ya no puede tomar el caso/)).toBeInTheDocument()
    expect(currentLocation()).toBe('/support/inbox/case-1')
  })

  it('says when there is no one to pass it to', async () => {
    api.on('GET', `${AGENT}/colleagues`, [])
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar a un colega' }))

    expect(await within(await screen.findByRole('dialog')).findByText('No hay más agentes activos en el equipo.')).toBeInTheDocument()
  })

  it('is not offered once the case closes', async () => {
    api.on('GET', `${AGENT}/conversations/{id}`, { ...theCase, status: 'RESOLVED' })
    open()

    expect(await screen.findByText('Este caso ya se cerró.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Devolver a la fila' })).not.toBeInTheDocument()
  })
})

describe('saved replies', () => {
  const reply = { id: 'r-1', title: 'Saludo', text: 'Hola, ya reviso tu caso.', createdAt: AT }

  it('writes one in the message, where it can still be changed', async () => {
    api.on('GET', `${AGENT}/replies`, [reply])
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Respuestas guardadas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Usar la respuesta Saludo' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Mensaje' })).toHaveValue('Hola, ya reviso tu caso.'))
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/messages`)).toHaveLength(0)
  })

  it('keeps what is being written as the text of a new one', async () => {
    api.on('GET', `${AGENT}/replies`, [])
    api.on('POST', `${AGENT}/replies`, () => {
      api.on('GET', `${AGENT}/replies`, [reply])
      return json(201, reply)
    })
    open()

    await userEvent.type(await screen.findByRole('textbox', { name: 'Mensaje' }), 'Hola, ya reviso tu caso.')
    await userEvent.click(screen.getByRole('button', { name: 'Respuestas guardadas' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Aún no guardas respuestas.')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Texto' })).toHaveValue('Hola, ya reviso tu caso.')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Saludo')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByRole('button', { name: 'Usar la respuesta Saludo' })).toBeInTheDocument()
    expect(api.callsTo('POST', `${AGENT}/replies`)[0]!.body).toEqual({ title: 'Saludo', text: 'Hola, ya reviso tu caso.' })
    // Saving it did not send the message
    expect(api.callsTo('POST', `${AGENT}/conversations/{id}/messages`)).toHaveLength(0)
  })

  it('deletes one', async () => {
    api.on('GET', `${AGENT}/replies`, [reply])
    api.on('DELETE', `${AGENT}/replies/{id}`, () => {
      api.on('GET', `${AGENT}/replies`, [])
      return json(204)
    })
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Respuestas guardadas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar la respuesta Saludo' }))

    expect(await screen.findByText('Aún no guardas respuestas.')).toBeInTheDocument()
  })

  it('refuses what the API would before it travels', async () => {
    api.on('GET', `${AGENT}/replies`, [])
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Respuestas guardadas' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Saludo')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Texto' }), 'a <b> c')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText(/no puede llevar los signos/)).toBeInTheDocument()
    expect(api.callsTo('POST', `${AGENT}/replies`)).toHaveLength(0)
  })

  it('explains the limit', async () => {
    api.on('GET', `${AGENT}/replies`, [])
    api.on('POST', `${AGENT}/replies`, problem(409, 'SUPPORT_SAVED_REPLY_LIMIT'))
    open()

    await userEvent.click(await screen.findByRole('button', { name: 'Respuestas guardadas' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Título' }), 'Saludo')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Texto' }), 'Hola')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText(/Ya tienes 50 respuestas guardadas/)).toBeInTheDocument()
  })
})
