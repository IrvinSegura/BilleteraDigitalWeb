import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()

const { ForgotPasswordPage } = await import('./ForgotPasswordPage')
const { ResetPasswordPage } = await import('./ResetPasswordPage')

// The emailed link carries its token in the fragment
const openLink = (hash: string) => window.history.replaceState(null, '', `/reset-password${hash}`)

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('POST', '/api/v1/auth/password-reset', json(202))
  })

  it('asks for the link and answers the same for any email', async () => {
    renderWithProviders(<ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument()
    expect(api.callsTo('POST', '/api/v1/auth/password-reset')[0]!.body).toEqual({ email: 'ana@example.com' })
  })

  it('shows a refusal such as too many requests', async () => {
    api.on('POST', '/api/v1/auth/password-reset', problem(429, 'RATE_LIMITED'))
    renderWithProviders(<ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByText(/Demasiadas solicitudes/)).toBeInTheDocument()
  })
})

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('POST', '/api/v1/auth/password-reset/confirm', json(204))
  })

  async function choose(password: string, confirm = password) {
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), password)
    await userEvent.type(screen.getByLabelText('Confirma la contraseña'), confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
  }

  it('reads the token once and wipes it from the address bar', async () => {
    openLink('#token=tok-123')
    renderWithProviders(<ResetPasswordPage />)
    expect(window.location.hash).toBe('')
    await choose('otra frase muy segura')
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    expect(api.callsTo('POST', '/api/v1/auth/password-reset/confirm')[0]!.body)
      .toEqual({ token: 'tok-123', newPassword: 'otra frase muy segura' })
  })

  it('says the link is invalid without a token', () => {
    openLink('')
    renderWithProviders(<ResetPasswordPage />)
    expect(screen.getByText('Enlace no válido')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/forgot-password')
  })

  it('checks both passwords match', async () => {
    openLink('#token=tok-123')
    renderWithProviders(<ResetPasswordPage />)
    await choose('otra frase muy segura', 'otra frase distinta')
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
  })

  it('turns an expired token into the invalid link screen', async () => {
    api.on('POST', '/api/v1/auth/password-reset/confirm', problem(400, 'INVALID_TOKEN'))
    openLink('#token=tok-viejo')
    renderWithProviders(<ResetPasswordPage />)
    await choose('otra frase muy segura')
    expect(await screen.findByText('Enlace no válido')).toBeInTheDocument()
  })
})
