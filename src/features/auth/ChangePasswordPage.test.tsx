import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { auth, testUser } from '@/test/auth'
import { currentLocation, renderWithProviders } from '@/test/render'

vi.mock('@/auth/auth-context', async (original) => ({ ...await original<object>(), ...(await import('@/test/auth')).authMock }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { toast } = await import('sonner')
const { RequireAuth } = await import('@/auth/RequireAuth')
const { ChangePasswordPage } = await import('./ChangePasswordPage')

const NEW_PASSWORD = 'Una-Clave-Propia-Y-Larga-7!'

function open(route = '/support/inbox') {
  return renderWithProviders(
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/support/inbox" element={<p>Bandeja</p>} />
        <Route path="/admin" element={<p>Consola</p>} />
      </Route>
    </Routes>,
    { route },
  )
}

async function fillIn(current: string, next = NEW_PASSWORD) {
  await userEvent.type(screen.getByLabelText('Contraseña del correo'), current)
  await userEvent.type(screen.getByLabelText('Nueva contraseña'), next)
  await userEvent.type(screen.getByLabelText('Confírmala'), next)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))
}

describe('having to change the emailed password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.reset(testUser({ role: 'SUPPORT', mustChangePassword: true }))
  })

  it('keeps the account on this page whatever it asks for', () => {
    open('/support/inbox')

    expect(screen.getByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument()
    expect(screen.queryByText('Bandeja')).not.toBeInTheDocument()
    expect(currentLocation()).toBe('/change-password')
  })

  it('changes it, then asks who the user is again so the app opens', async () => {
    auth.changePassword.mockResolvedValue(undefined)
    auth.refreshUser.mockResolvedValue(undefined)
    open()

    await fillIn('abcd-EFGH-2345-jkmn')

    await waitFor(() => expect(auth.changePassword).toHaveBeenCalledWith('abcd-EFGH-2345-jkmn', NEW_PASSWORD))
    await waitFor(() => expect(auth.refreshUser).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith('Listo, ya tienes tu propia contraseña.')
  })

  it('does not let the same password through', async () => {
    open()

    await fillIn(NEW_PASSWORD)

    expect(await screen.findByText('Debe ser distinta de la actual')).toBeInTheDocument()
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('says it on the field when the emailed password is wrong', async () => {
    auth.changePassword.mockRejectedValue(new ApiError(401, { code: 'INCORRECT_PASSWORD' }))
    open()

    await fillIn('otra-cosa')

    expect(await screen.findByLabelText('Contraseña del correo')).toHaveAttribute('aria-invalid', 'true')
    expect(auth.refreshUser).not.toHaveBeenCalled()
  })

  it('says it on the field when the API refuses the new one', async () => {
    auth.changePassword.mockRejectedValue(new ApiError(422, { code: 'PASSWORD_UNCHANGED' }))
    open()

    await fillIn('abcd-EFGH-2345-jkmn')

    expect(await screen.findByLabelText('Nueva contraseña')).toHaveAttribute('aria-invalid', 'true')
  })

  it('lets them leave', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(auth.logout).toHaveBeenCalled()
  })
})

describe('without having to', () => {
  beforeEach(() => auth.reset(testUser({ role: 'ADMIN', mustChangePassword: false })))

  it('lets the app open', () => {
    open('/admin')

    expect(screen.getByText('Consola')).toBeInTheDocument()
  })

  it('has no reason to stay on the page', () => {
    open('/change-password')

    expect(screen.getByText('Consola')).toBeInTheDocument()
  })
})
