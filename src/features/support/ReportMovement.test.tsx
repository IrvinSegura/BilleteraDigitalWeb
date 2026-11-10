import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
const { SupportPage } = await import('./SupportPage')

const CONVERSATION = '/api/v1/support/conversation'
const MOVEMENT = '/api/v1/wallets/{walletId}/movements/{transactionId}'
const AT = '2026-11-05T12:00:00Z'
const FOLIO = 'aaaaaaaa-0000-4000-8000-000000000001'
const ROUTE = '/support?wallet=w-1&movement=t-1'
const movement = {
  transactionId: 't-1', type: 'DEPOSIT', direction: 'IN', operationId: FOLIO, amount: { amount: '250.00', currency: 'MXN' },
  balanceAfter: { amount: '250.00', currency: 'MXN' }, createdAt: AT,
}
const conversation = (status: string) => ({
  id: 'conversation-1', status, awaitsSurvey: false, createdAt: AT, queuePosition: 1,
  messages: [{ id: 'm1', sender: 'USER', text: 'Reporto un problema', asksFeedback: false, createdAt: AT }],
})

function open(route = ROUTE) {
  renderWithProviders(<SupportPage />, { route, path: '/support' })
}

async function report(text = 'Pagué y no llegó') {
  await userEvent.type(await screen.findByRole('textbox', { name: '¿Qué pasó?' }), text)
  await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))
}

describe('reporting a problem with a movement', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', CONVERSATION, json(204))
    api.on('GET', MOVEMENT, movement)
  })

  it('names the movement and takes the customer to a person, before the bot can answer', async () => {
    api.on('POST', `${CONVERSATION}/messages`, conversation('QUEUED'))
    api.on('POST', `${CONVERSATION}/escalate`, conversation('QUEUED'))
    open()

    expect(await screen.findByText('Depósito')).toBeInTheDocument()
    await report()

    await waitFor(() => expect(api.callsTo('POST', `${CONVERSATION}/messages`)).toHaveLength(1))
    const paths = api.calls.filter((call) => call.method === 'POST').map((call) => call.path)
    expect(paths).toEqual([`${CONVERSATION}/escalate`, `${CONVERSATION}/messages`])
    const { text } = api.callsTo('POST', `${CONVERSATION}/messages`)[0]!.body as { text: string }
    expect(text).toContain('Depósito por $250.00 (')
    expect(text).toContain(`Folio: ${FOLIO}`)
    expect(text).toContain('Pagué y no llegó')
    await waitFor(() => expect(currentLocation()).toBe('/support'))
    expect(screen.queryByRole('textbox', { name: '¿Qué pasó?' })).not.toBeInTheDocument()
  })

  it('does not ask for a person again when one is already attending', async () => {
    api.on('GET', CONVERSATION, conversation('ASSIGNED'))
    api.on('POST', `${CONVERSATION}/messages`, conversation('ASSIGNED'))
    open()

    await report()

    await waitFor(() => expect(currentLocation()).toBe('/support'))
    expect(api.callsTo('POST', `${CONVERSATION}/escalate`)).toHaveLength(0)
  })

  it('keeps what was written when it could not be sent', async () => {
    api.on('POST', `${CONVERSATION}/escalate`, conversation('QUEUED'))
    api.on('POST', `${CONVERSATION}/messages`, problem(500, 'INTERNAL', 'Falló'))
    open()

    await report()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '¿Qué pasó?' })).toHaveValue('Pagué y no llegó')
    expect(currentLocation()).toBe(ROUTE)
  })

  it('refuses what the API would before it travels', async () => {
    open()

    await report('a <b> c')

    expect(await screen.findByText(/no puede llevar los signos/)).toBeInTheDocument()
    expect(api.callsTo('POST', `${CONVERSATION}/messages`)).toHaveLength(0)
  })

  it('can be left, for the plain chat', async () => {
    open()

    await screen.findByRole('textbox', { name: '¿Qué pasó?' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(currentLocation()).toBe('/support'))
    expect(screen.queryByRole('textbox', { name: '¿Qué pasó?' })).not.toBeInTheDocument()
  })

  it('shows only the chat without a movement, or with one that is not theirs', async () => {
    api.on('GET', MOVEMENT, problem(404, 'MOVEMENT_NOT_FOUND'))
    open()

    expect(await screen.findByText(/soy el asistente de Billetera/)).toBeInTheDocument()
    await waitFor(() => expect(api.callsTo('GET', MOVEMENT)).toHaveLength(1))
    expect(screen.queryByText('Enviar reporte')).not.toBeInTheDocument()
  })
})
