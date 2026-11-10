import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { IdentityVerificationPage } = await import('./IdentityVerificationPage')

const ME = '/api/v1/users/me/identity-verification'
const notStarted = { status: 'NOT_STARTED', attemptsLeft: 3 }
const photo = (name: string) => new File([new Uint8Array(2048)], name, { type: 'image/jpeg' })

function render() {
  renderWithProviders(<IdentityVerificationPage />, { route: '/settings/identity' })
}

async function fillIn(user: ReturnType<typeof userEvent.setup>, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    'Nombre(s)': 'Juan', 'Primer apellido': 'Gómez', 'Segundo apellido (si tienes)': 'Martínez',
    CURP: 'gomj900515hdfmrb02', 'Clave de elector': 'GMMRJN90051509H123', CIC: '123456789',
    'Identificador del ciudadano': '987654321', Vigencia: String(new Date().getFullYear() + 5), ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    await user.type(screen.getByLabelText(label, { selector: 'input[type="text"], input:not([type])' }), value)
  }
}

describe('IdentityVerificationPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    URL.createObjectURL = () => 'blob:photo'
    URL.revokeObjectURL = () => {}
    api.on('GET', ME, notStarted)
  })

  it('only shows where the review stands while it is under way', async () => {
    api.on('GET', ME, { status: 'PENDING_REVIEW', curpLastFour: 'RB02', submittedAt: '2026-11-05T18:00:00Z', attemptsLeft: 2 })
    render()

    expect(await screen.findByRole('status')).toHaveTextContent('Estamos revisando tu INE')
    expect(screen.getByText('CURP terminación RB02')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar para revisión' })).not.toBeInTheDocument()
  })

  it('shows why it was rejected and lets the customer send it again', async () => {
    api.on('GET', ME, { status: 'REJECTED', rejectionReason: 'La foto del reverso está borrosa', attemptsLeft: 2 })
    render()

    expect(await screen.findByText('Motivo: La foto del reverso está borrosa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar para revisión' })).toBeInTheDocument()
    expect(screen.getByText('Te quedan 2 intentos hoy.')).toBeInTheDocument()
  })

  it('catches a mistyped CURP and the missing photos before uploading anything', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByRole('button', { name: 'Enviar para revisión' })

    await fillIn(user, { CURP: 'GOMJ900515HDFMRB03' })
    await user.click(screen.getByRole('button', { name: 'Enviar para revisión' }))

    expect(await screen.findByText('La CURP no es válida; revisa los 18 caracteres.')).toBeInTheDocument()
    expect(screen.getAllByText('Agrega esta foto.')).toHaveLength(3)
    expect(api.callsTo('POST', ME)).toHaveLength(0)
  })

  it('sends the card and its photos in the form body, never in the address', async () => {
    api.on('POST', ME, { status: 'PENDING_REVIEW', curpLastFour: 'RB02', attemptsLeft: 2 })
    const user = userEvent.setup()
    render()
    await screen.findByRole('button', { name: 'Enviar para revisión' })

    await fillIn(user)
    await user.upload(screen.getByLabelText('Frente de la INE'), photo('front.jpg'))
    await user.upload(screen.getByLabelText('Reverso de la INE'), photo('back.jpg'))
    await user.upload(screen.getByLabelText('Tu rostro'), photo('selfie.jpg'))
    await user.click(screen.getByRole('button', { name: 'Enviar para revisión' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Estamos revisando tu INE')
    const [post] = api.callsTo('POST', ME)
    expect([...post!.query.keys()]).toEqual([])
    expect(post!.headers.get('Content-Type')).toMatch(/^multipart\/form-data/)
  })

  it('says what the API found wrong', async () => {
    api.on('POST', ME, problem(409, 'IDENTITY_VERIFICATION_CONFLICT', 'Identity verification conflict: DOCUMENT_IN_USE'))
    const user = userEvent.setup()
    render()
    await screen.findByRole('button', { name: 'Enviar para revisión' })

    await fillIn(user)
    for (const label of ['Frente de la INE', 'Reverso de la INE', 'Tu rostro']) {
      await user.upload(screen.getByLabelText(label), photo(`${label}.jpg`))
    }
    await user.click(screen.getByRole('button', { name: 'Enviar para revisión' }))

    await waitFor(() => expect(screen.getByText(/ya está registrada en otra cuenta/)).toBeInTheDocument())
  })
})
