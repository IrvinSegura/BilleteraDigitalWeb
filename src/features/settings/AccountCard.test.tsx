import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), save: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('@/lib/download', () => ({ saveFile: mocks.save }))

const { AccountCard } = await import('./AccountCard')

async function openDialog(trigger: string) {
  renderWithProviders(<AccountCard />)
  await userEvent.click(screen.getByRole('button', { name: trigger }))
  return within(await screen.findByRole('dialog'))
}

describe('AccountCard', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    mocks.success.mockReset()
    mocks.error.mockReset()
    mocks.save.mockReset()
  })

  describe('changing the email', () => {
    it('sends the link to the new address with the password', async () => {
      api.on('POST', '/api/v1/users/me/email', json(202))
      const dialog = await openDialog('Cambiar correo')

      await userEvent.type(dialog.getByLabelText('Correo nuevo'), ' nuevo@example.com ')
      await userEvent.type(dialog.getByLabelText('Contraseña actual'), 'secreta-123')
      await userEvent.click(dialog.getByRole('button', { name: 'Enviar enlace' }))

      await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Te enviamos un enlace a nuevo@example.com. Ábrelo para terminar el cambio.'))
      expect(api.callsTo('POST', '/api/v1/users/me/email')[0]!.body).toEqual({ newEmail: 'nuevo@example.com', currentPassword: 'secreta-123' })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('asks for the second factor when the account has one', async () => {
      auth.reset(testUser({ twoFactorEnabled: true }))
      api.on('POST', '/api/v1/users/me/email', json(202))
      const dialog = await openDialog('Cambiar correo')

      await userEvent.type(dialog.getByLabelText('Correo nuevo'), 'nuevo@example.com')
      await userEvent.type(dialog.getByLabelText('Contraseña actual'), 'secreta-123')
      expect(dialog.getByRole('button', { name: 'Enviar enlace' })).toBeDisabled()
      await userEvent.type(dialog.getByLabelText('Código de la app o de recuperación'), '123456')
      await userEvent.click(dialog.getByRole('button', { name: 'Enviar enlace' }))

      await waitFor(() => expect(api.callsTo('POST', '/api/v1/users/me/email')[0]?.body).toMatchObject({ twoFactorCode: '123456' }))
    })

    it('puts a wrong password under its field and a taken address below the form', async () => {
      api.on('POST', '/api/v1/users/me/email', problem(401, 'INCORRECT_PASSWORD'))
      const dialog = await openDialog('Cambiar correo')
      await userEvent.type(dialog.getByLabelText('Correo nuevo'), 'nuevo@example.com')
      await userEvent.type(dialog.getByLabelText('Contraseña actual'), 'mala')
      await userEvent.click(dialog.getByRole('button', { name: 'Enviar enlace' }))
      expect(await dialog.findByText('La contraseña es incorrecta.')).toBeInTheDocument()

      api.on('POST', '/api/v1/users/me/email', problem(409, 'EMAIL_ALREADY_REGISTERED'))
      await userEvent.click(dialog.getByRole('button', { name: 'Enviar enlace' }))
      expect(await dialog.findByText('Ya existe una cuenta con este correo.')).toBeInTheDocument()
    })
  })

  it('downloads a copy of the data as JSON', async () => {
    api.on('GET', '/api/v1/users/me/export', { profile: { email: 'ana@example.com' }, wallets: [] })
    renderWithProviders(<AccountCard />)

    await userEvent.click(screen.getByRole('button', { name: 'Descargar mis datos' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    const [blob, name] = mocks.save.mock.calls[0]!
    expect(name).toMatch(/^billetera-datos-\d{4}-\d{2}-\d{2}\.json$/)
    expect(JSON.parse(await (blob as Blob).text())).toEqual({ profile: { email: 'ana@example.com' }, wallets: [] })
    expect(mocks.success).toHaveBeenCalledWith('Descargamos tus datos.')
  })

  describe('closing the account', () => {
    async function fillClose(word = 'cerrar') {
      const dialog = await openDialog('Cerrar mi cuenta')
      await userEvent.type(dialog.getByLabelText('Contraseña actual'), 'secreta-123')
      await userEvent.type(dialog.getByLabelText('Escribe CERRAR para confirmar'), word)
      return dialog
    }

    it('needs the confirmation word before it can be sent', async () => {
      const dialog = await fillClose('cerra')

      expect(dialog.getByRole('button', { name: 'Cerrar mi cuenta' })).toBeDisabled()
    })

    it('closes it and signs out', async () => {
      api.on('POST', '/api/v1/users/me/close', json(204))
      const dialog = await fillClose()

      await userEvent.click(dialog.getByRole('button', { name: 'Cerrar mi cuenta' }))

      await waitFor(() => expect(auth.logout).toHaveBeenCalledOnce())
      expect(api.callsTo('POST', '/api/v1/users/me/close')[0]!.body).toEqual({ currentPassword: 'secreta-123' })
      expect(mocks.success).toHaveBeenCalledWith('Cerraste tu cuenta.')
    })

    it('says what is still in the way', async () => {
      api.on('POST', '/api/v1/users/me/close', problem(422, 'ACCOUNT_CANNOT_BE_CLOSED', 'The account cannot be closed: BALANCE'))
      const dialog = await fillClose()

      await userEvent.click(dialog.getByRole('button', { name: 'Cerrar mi cuenta' }))

      expect(await dialog.findByText('Todavía tienes saldo. Retíralo o envíalo antes de cerrar tu cuenta.')).toBeInTheDocument()
      expect(auth.logout).not.toHaveBeenCalled()
    })
  })
})
