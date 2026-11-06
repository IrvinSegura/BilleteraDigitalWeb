import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { auth } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { LoginPage } = await import('./LoginPage')

const refusal = (code: string) => new ApiError(401, { code })

async function signIn(email = 'ana@example.com', password = 'Secreta#2026') {
  await userEvent.type(screen.getByLabelText('Correo electrónico'), email)
  await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('LoginPage', () => {
  beforeEach(() => auth.reset(null))
  afterEach(() => vi.unstubAllEnvs())

  it('offers the support address to whoever cannot sign in, when there is one', () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'ayuda@example.com')
    renderWithProviders(<LoginPage />)
    expect(screen.getByRole('link', { name: 'ayuda@example.com' })).toHaveAttribute('href', 'mailto:ayuda@example.com')
    expect(screen.getByText(/¿No puedes entrar\?/)).toBeInTheDocument()
  })

  it('offers nothing when no support address is set', () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', '')
    renderWithProviders(<LoginPage />)
    expect(screen.queryByText(/¿No puedes entrar\?/)).not.toBeInTheDocument()
  })

  it('offers the support address on the two-factor step too, for a lost phone', async () => {
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'ayuda@example.com')
    auth.login.mockRejectedValueOnce(refusal('TWO_FACTOR_REQUIRED'))
    renderWithProviders(<LoginPage />)
    await signIn()
    expect(await screen.findByText(/¿Perdiste tu teléfono y tus códigos\?/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ayuda@example.com' })).toBeInTheDocument()
  })

  it('checks the fields before calling the API', async () => {
    renderWithProviders(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Escribe un correo válido')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña')).toBeInTheDocument()
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('signs in with the email and password', async () => {
    renderWithProviders(<LoginPage />)
    await signIn()
    expect(auth.login).toHaveBeenCalledWith('ana@example.com', 'Secreta#2026', undefined)
  })

  it('says the credentials are wrong without saying which', async () => {
    auth.login.mockRejectedValue(refusal('INVALID_CREDENTIALS'))
    renderWithProviders(<LoginPage />)
    await signIn()
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
  })

  it('asks for the two-factor code as a second step', async () => {
    auth.login.mockRejectedValueOnce(refusal('TWO_FACTOR_REQUIRED'))
    renderWithProviders(<LoginPage />)
    await signIn()

    expect(await screen.findByText('Verificación en dos pasos')).toBeInTheDocument()
    const verify = screen.getByRole('button', { name: 'Verificar y entrar' })
    expect(verify).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Código de verificación'), '123456')
    await userEvent.click(verify)
    expect(auth.login).toHaveBeenLastCalledWith('ana@example.com', 'Secreta#2026', '123456')
  })

  it('blames the code, not the password, when the second step fails', async () => {
    auth.login.mockRejectedValueOnce(refusal('TWO_FACTOR_REQUIRED')).mockRejectedValueOnce(refusal('INVALID_CREDENTIALS'))
    renderWithProviders(<LoginPage />)
    await signIn()
    const code = await screen.findByLabelText('Código de verificación')
    await userEvent.type(code, '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Verificar y entrar' }))

    expect(await screen.findByText('El código es incorrecto, expiró o ya se usó.')).toBeInTheDocument()
    expect(code).toHaveValue('')
  })

  it('goes back from the code step to use another account', async () => {
    auth.login.mockRejectedValueOnce(refusal('TWO_FACTOR_REQUIRED'))
    renderWithProviders(<LoginPage />)
    await signIn()
    await userEvent.click(await screen.findByRole('button', { name: 'Usar otra cuenta' }))
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('offers a new verification link to an unverified account', async () => {
    auth.login.mockRejectedValue(refusal('EMAIL_NOT_VERIFIED'))
    renderWithProviders(<LoginPage />)
    await signIn()

    expect(await screen.findByText('Confirma tu correo')).toBeInTheDocument()
    expect(screen.getByText(/ana@example\.com/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar un nuevo enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Te enviamos un nuevo enlace.')
    expect(auth.login).toHaveBeenLastCalledWith('ana@example.com', 'Secreta#2026', undefined, { resendVerification: true })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enviar un nuevo enlace' })).not.toBeInTheDocument())
  })
})
