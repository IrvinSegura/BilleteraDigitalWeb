import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { ConfirmEmailChangePage } = await import('./ConfirmEmailChangePage')

const openLink = (hash: string) => window.history.replaceState(null, '', `/confirm-email-change${hash}`)

describe('ConfirmEmailChangePage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(null)
    api.on('POST', '/api/v1/auth/email-change/confirm', json(204))
  })

  it('posts the token once and sends a signed-out visitor to sign in with the new address', async () => {
    openLink('#token=tok-1')
    renderWithProviders(<ConfirmEmailChangePage />)

    expect(await screen.findByText('¡Correo actualizado!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login')
    expect(api.callsTo('POST', '/api/v1/auth/email-change/confirm')).toHaveLength(1)
    expect(api.calls[0]!.body).toEqual({ token: 'tok-1' })
    expect(window.location.hash).toBe('')
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('signs out this tab too, since every session ended with the change', async () => {
    auth.reset(testUser())
    openLink('#token=tok-1')
    renderWithProviders(<ConfirmEmailChangePage />)

    await waitFor(() => expect(auth.logout).toHaveBeenCalledOnce())
  })

  it('explains an expired link and keeps a signed-in user in the app', async () => {
    auth.reset(testUser())
    api.on('POST', '/api/v1/auth/email-change/confirm', problem(400, 'INVALID_TOKEN'))
    openLink('#token=tok-1')
    renderWithProviders(<ConfirmEmailChangePage />)

    expect(await screen.findByText('No pudimos cambiarlo')).toBeInTheDocument()
    expect(screen.getByText('El enlace no es válido o ya expiró; solicita uno nuevo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a mi billetera' })).toHaveAttribute('href', '/')
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('says an incomplete link needs opening again, without calling the API', () => {
    openLink('')
    renderWithProviders(<ConfirmEmailChangePage />)

    expect(screen.getByText(/El enlace está incompleto/)).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
  })
})
