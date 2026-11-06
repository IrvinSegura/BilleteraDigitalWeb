import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { VerifyEmailPage } = await import('./VerifyEmailPage')

const openLink = (hash: string) => window.history.replaceState(null, '', `/verify-email${hash}`)

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(null)
    api.on('POST', '/api/v1/auth/email-verification/confirm', json(204))
  })

  it('posts the token once and invites a signed-out visitor to sign in', async () => {
    openLink('#token=tok-1')
    renderWithProviders(<VerifyEmailPage />)
    expect(await screen.findByText('¡Correo verificado!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
    expect(api.callsTo('POST', '/api/v1/auth/email-verification/confirm')).toHaveLength(1)
    expect(api.calls[0]!.body).toEqual({ token: 'tok-1' })
    expect(window.location.hash).toBe('')
  })

  it('reloads the profile of a signed-in user', async () => {
    auth.reset(testUser({ emailVerified: false }))
    openLink('#token=tok-1')
    renderWithProviders(<VerifyEmailPage />)
    expect(await screen.findByText('Ya puedes enviar y retirar dinero.')).toBeInTheDocument()
    expect(auth.refreshUser).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ir a mi billetera' })).toHaveAttribute('href', '/')
  })

  it('counts an already verified email as a success', async () => {
    api.on('POST', '/api/v1/auth/email-verification/confirm', problem(409, 'EMAIL_ALREADY_VERIFIED'))
    openLink('#token=tok-1')
    renderWithProviders(<VerifyEmailPage />)
    expect(await screen.findByText('¡Correo verificado!')).toBeInTheDocument()
  })

  it('explains an expired link', async () => {
    api.on('POST', '/api/v1/auth/email-verification/confirm', problem(400, 'INVALID_TOKEN'))
    openLink('#token=tok-1')
    renderWithProviders(<VerifyEmailPage />)
    expect(await screen.findByText('No pudimos verificarlo')).toBeInTheDocument()
    expect(screen.getByText('El enlace no es válido o ya expiró; solicita uno nuevo.')).toBeInTheDocument()
  })

  it('says an incomplete link needs opening again, without calling the API', () => {
    openLink('')
    renderWithProviders(<VerifyEmailPage />)
    expect(screen.getByText(/El enlace está incompleto/)).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
  })
})
