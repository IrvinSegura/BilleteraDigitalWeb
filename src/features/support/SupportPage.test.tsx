import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
const { SupportPage } = await import('./SupportPage')

const CONVERSATION = '/api/v1/support/conversation'
const AT = '2026-11-05T12:00:00Z'
const message = (sender: string, text: string, extra = {}) => ({ id: `${sender}-${text}`, sender, text, asksFeedback: false, createdAt: AT, ...extra })
const conversation = (status: string, messages: unknown[], extra = {}) => ({
  id: 'conversation-1', status, awaitsSurvey: false, createdAt: AT, messages, ...extra,
})
const answered = conversation('BOT', [
  message('USER', '¿Cómo deposito?'),
  message('BOT', 'Elige **Depositar** en tu billetera.', { asksFeedback: true }),
])

function picker() {
  return screen.findByTestId('support-file')
}

describe('SupportPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', CONVERSATION, json(204))
  })

  it('welcomes whoever has no conversation and lets them ask for a person', async () => {
    api.on('POST', `${CONVERSATION}/escalate`, conversation('QUEUED', [message('SYSTEM', '', { text: undefined, event: 'ESCALATED' })], { queuePosition: 2 }))
    renderWithProviders(<SupportPage />)

    expect(await screen.findByText(/soy el asistente de Billetera/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hablar con una persona' }))

    expect(await screen.findByRole('status')).toHaveTextContent('en el lugar 2')
    expect(screen.getByText('Pasamos la conversación a una persona de soporte.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hablar con una persona' })).not.toBeInTheDocument()
  })

  it("sends what is written and shows the bot's answer, with its names of buttons in bold", async () => {
    api.on('POST', `${CONVERSATION}/messages`, answered)
    renderWithProviders(<SupportPage />)

    const box = await screen.findByRole('textbox', { name: 'Mensaje' })
    await userEvent.type(box, '¿Cómo deposito?{Enter}')

    expect(await screen.findByText('Depositar').then((node) => node.tagName)).toBe('STRONG')
    expect(api.callsTo('POST', `${CONVERSATION}/messages`)[0]!.body).toEqual({ text: '¿Cómo deposito?' })
    expect(box).toHaveValue('')
  })

  it('keeps a new line with shift and enter, and refuses what the API would refuse', async () => {
    renderWithProviders(<SupportPage />)
    const box = await screen.findByRole('textbox', { name: 'Mensaje' })

    await userEvent.type(box, 'a{Shift>}{Enter}{/Shift}<b{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('no puede llevar los signos')
    expect(box).toHaveValue('a\n<b')
    expect(api.callsTo('POST', `${CONVERSATION}/messages`)).toHaveLength(0)
  })

  it('keeps the text when sending fails, and says why', async () => {
    api.on('POST', `${CONVERSATION}/messages`, problem(422, 'SUPPORT_CONVERSATION_CLOSED'))
    renderWithProviders(<SupportPage />)

    const box = await screen.findByRole('textbox', { name: 'Mensaje' })
    await userEvent.type(box, 'hola{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta conversación ya se cerró.')
    expect(box).toHaveValue('hola')
  })

  it('closes the conversation when the answer helped', async () => {
    api.on('GET', CONVERSATION, answered)
    api.on('POST', `${CONVERSATION}/close`, json(204))
    renderWithProviders(<SupportPage />)

    expect(await screen.findByText('¿Te sirvió?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, gracias' }))

    await waitFor(() => expect(api.callsTo('POST', `${CONVERSATION}/close`)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText('¿Te sirvió?')).not.toBeInTheDocument())
    expect(screen.queryByText('¿Cómo deposito?')).not.toBeInTheDocument()
  })

  it('passes to a person when the answer did not help', async () => {
    api.on('GET', CONVERSATION, answered)
    api.on('POST', `${CONVERSATION}/escalate`, conversation('ASSIGNED', answered.messages, { agentName: 'Laura' }))
    renderWithProviders(<SupportPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'No, hablar con una persona' }))

    expect(await screen.findByText('Laura te está atendiendo.')).toBeInTheDocument()
    expect(screen.queryByText('¿Te sirvió?')).not.toBeInTheDocument()
  })

  it('offers common questions until something is said, and picking one asks it', async () => {
    api.on('POST', `${CONVERSATION}/messages`, answered)
    renderWithProviders(<SupportPage />)

    await userEvent.click(await screen.findByRole('button', { name: '¿Qué divisas manejan?' }))

    await waitFor(() => expect(api.callsTo('POST', `${CONVERSATION}/messages`)[0]!.body).toEqual({ text: '¿Qué divisas manejan?' }))
    await screen.findByText('Depositar')
    expect(screen.queryByRole('button', { name: '¿Qué divisas manejan?' })).not.toBeInTheDocument()
  })

  it('lets the user pick what the bot thinks they meant', async () => {
    const offered = conversation('BOT', [
      message('USER', 'mi dinero'),
      message('BOT', 'Creo que entendí solo una parte.', { suggestions: ['¿Cómo deposito dinero?', '¿Cómo retiro dinero a mi banco?'] }),
    ])
    api.on('GET', CONVERSATION, offered)
    api.on('POST', `${CONVERSATION}/messages`, answered)
    renderWithProviders(<SupportPage />)

    await userEvent.click(await screen.findByRole('button', { name: '¿Cómo retiro dinero a mi banco?' }))
    await waitFor(() => expect(api.callsTo('POST', `${CONVERSATION}/messages`)[0]!.body).toEqual({ text: '¿Cómo retiro dinero a mi banco?' }))

    await screen.findByText('Depositar')
    expect(screen.queryByRole('button', { name: '¿Cómo retiro dinero a mi banco?' })).not.toBeInTheDocument()
  })

  it('passes to a person when none of what the bot offers is what they meant', async () => {
    api.on('GET', CONVERSATION, conversation('BOT', [
      message('BOT', 'Creo que entendí solo una parte.', { suggestions: ['¿Cómo deposito dinero?'] }),
    ]))
    api.on('POST', `${CONVERSATION}/escalate`, conversation('QUEUED', [], { queuePosition: 1 }))
    renderWithProviders(<SupportPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ninguna, hablar con una persona' }))

    expect(await screen.findByRole('status')).toHaveTextContent('en el lugar 1')
    expect(screen.queryByRole('button', { name: '¿Cómo deposito dinero?' })).not.toBeInTheDocument()
  })

  it('stops offering what the bot suggested once a person takes over', async () => {
    api.on('GET', CONVERSATION, conversation('QUEUED', [
      message('BOT', 'Creo que entendí solo una parte.', { suggestions: ['¿Cómo deposito dinero?'] }),
    ], { queuePosition: 1 }))
    renderWithProviders(<SupportPage />)

    await screen.findByText('Creo que entendí solo una parte.')
    expect(screen.queryByRole('button', { name: '¿Cómo deposito dinero?' })).not.toBeInTheDocument()
  })

  it("only asks if an answer helped while it is the bot's last word", async () => {
    api.on('GET', CONVERSATION, conversation('BOT', [
      message('BOT', 'Elige **Depositar**.', { asksFeedback: true }),
      message('USER', 'hola'),
    ]))
    renderWithProviders(<SupportPage />)

    expect(await screen.findByText('hola')).toBeInTheDocument()
    expect(screen.queryByText('¿Te sirvió?')).not.toBeInTheDocument()
  })

  it('checks a file before sending it', async () => {
    renderWithProviders(<SupportPage />)
    const input = await picker()

    fireEvent.change(input, { target: { files: [new File(['x'], 'nota.txt', { type: 'text/plain' })] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo puedes enviar')

    const big = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [big] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('pesa más de 20 MB')
    expect(api.callsTo('POST', `${CONVERSATION}/attachments`)).toHaveLength(0)
  })

  it('shows a picture it reaches with its token, and offers to download other files', async () => {
    URL.createObjectURL = () => 'blob:picture'
    URL.revokeObjectURL = () => undefined
    api.on('GET', '/api/v1/support/attachments/{attachmentId}', () => new Response(new Blob(['x'], { type: 'image/png' })))
    api.on('GET', CONVERSATION, conversation('ASSIGNED', [
      message('USER', '', { text: undefined, attachment: { id: 'a-1', fileName: 'captura.png', contentType: 'image/png', sizeBytes: 2048 } }),
      message('AGENT', '', { text: undefined, attachment: { id: 'a-2', fileName: 'guia.pdf', contentType: 'application/pdf', sizeBytes: 3 * 1024 * 1024 } }),
    ], { agentName: 'Laura' }))
    renderWithProviders(<SupportPage />)

    expect(await screen.findByRole('img', { name: 'captura.png' })).toHaveAttribute('src', 'blob:picture')
    expect(screen.getByText('3.0 MB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar guia.pdf' })).toBeInTheDocument()
    // A PDF isn't fetched until someone asks for it
    expect(api.callsTo('GET', '/api/v1/support/attachments/{attachmentId}')).toHaveLength(1)
  })

  it('asks how it went once, with stars and an optional comment', async () => {
    api.on('GET', CONVERSATION, conversation('RESOLVED', [message('AGENT', 'Listo')], { agentName: 'Laura', awaitsSurvey: true }))
    api.on('POST', `${CONVERSATION}/survey`, () => {
      api.on('GET', CONVERSATION, json(204))
      return json(204)
    })
    renderWithProviders(<SupportPage />)

    const send = await screen.findByRole('button', { name: 'Enviar calificación' })
    expect(send).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '4 de 5' }))
    await userEvent.type(screen.getByLabelText('Comentario (opcional)'), 'Muy amable')
    await userEvent.click(send)

    expect(await screen.findByText('¡Gracias por tu opinión!')).toBeInTheDocument()
    expect(api.callsTo('POST', `${CONVERSATION}/survey`)[0]!.body).toEqual({ score: 4, comment: 'Muy amable' })
    expect(screen.queryByRole('button', { name: 'Enviar calificación' })).not.toBeInTheDocument()
  })

  it('does not ask for a survey on a conversation only the bot attended', async () => {
    api.on('GET', CONVERSATION, answered)
    renderWithProviders(<SupportPage />)

    await screen.findByText('¿Te sirvió?')
    expect(screen.queryByText('¿Cómo te atendimos?')).not.toBeInTheDocument()
  })

  it('reports a chat that could not be read, and tries again', async () => {
    api.on('GET', CONVERSATION, problem(500, 'INTERNAL_ERROR'))
    renderWithProviders(<SupportPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(api.callsTo('GET', CONVERSATION)).toHaveLength(2))
  })
})
