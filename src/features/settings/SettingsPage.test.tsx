import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/errors'
import { json, problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { SettingsPage } = await import('./SettingsPage')

const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const sessions = [
  { id: 's-1', current: true, userAgent: CHROME_WINDOWS, ipAddress: '10.0.0.1', startedAt: '2026-11-04T10:00:00Z', lastUsedAt: '2026-11-04T17:00:00Z' },
  { id: 's-2', current: false, userAgent: SAFARI_IPHONE, ipAddress: '10.0.0.2', startedAt: '2026-11-01T10:00:00Z', lastUsedAt: '2026-11-02T10:00:00Z' },
]

const card = (title: string) => screen.getByText(title, { selector: '[data-slot="card-title"], [data-slot="card-title"] *' })
  .closest('[data-slot="card"]') as HTMLElement

describe('SettingsPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset(testUser({ phone: '+525512345678' }))
    let preferences: unknown = { emailMoneyIn: true, emailMoneyOut: true, emailSignIns: false }
    api.on('GET', '/api/v1/notifications/preferences', () => preferences)
    api.on('PUT', '/api/v1/notifications/preferences', ({ body }) => (preferences = body))
    api.on('GET', '/api/v1/users/me/two-factor', { enabled: false, unusedRecoveryCodes: 0 })
    api.on('GET', '/api/v1/users/me/sessions', sessions)
    api.on('DELETE', '/api/v1/users/me/sessions/{sessionId}', json(204))
    api.on('DELETE', '/api/v1/users/me/sessions', { revoked: 1 })
    api.on('POST', '/api/v1/users/me/email-verification', json(202))
  })

  describe('profile', () => {
    it('shows the profile and offers the verification link only when the email is unverified', async () => {
      const { unmount } = renderWithProviders(<SettingsPage />)
      expect(screen.getByText('+525512345678')).toBeInTheDocument()
      expect(screen.getByText('Verificado')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reenviar enlace' })).not.toBeInTheDocument()
      unmount()

      auth.reset(testUser({ emailVerified: false }))
      renderWithProviders(<SettingsPage />)
      await userEvent.click(screen.getByRole('button', { name: 'Reenviar enlace' }))
      expect(await screen.findByRole('button', { name: 'Enlace enviado' })).toBeDisabled()
      expect(api.callsTo('POST', '/api/v1/users/me/email-verification')).toHaveLength(1)
    })

    it('edits the name and phone, checking the phone format first', async () => {
      renderWithProviders(<SettingsPage />)
      await userEvent.click(within(card('Ana López')).getByRole('button', { name: 'Editar' }))
      const dialog = await screen.findByRole('dialog')
      const phone = within(dialog).getByLabelText('Teléfono (opcional)')
      await userEvent.clear(phone)
      await userEvent.type(phone, '5512345678')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
      expect(await within(dialog).findByText(/Empieza con \+ y la lada/)).toBeInTheDocument()
      expect(auth.updateProfile).not.toHaveBeenCalled()

      await userEvent.clear(phone)
      await userEvent.type(phone, '+52 55 8765 4321')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
      await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith({ fullName: 'Ana López', phone: '+52 55 8765 4321' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('password', () => {
    async function change(current: string, next: string, confirm = next) {
      const form = card('Contraseña')
      await userEvent.type(within(form).getByLabelText('Contraseña actual'), current)
      await userEvent.type(within(form).getByLabelText('Nueva contraseña'), next)
      await userEvent.type(within(form).getByLabelText('Confírmala'), confirm)
      await userEvent.click(within(form).getByRole('button', { name: 'Actualizar contraseña' }))
      return form
    }

    it('changes it and empties the form', async () => {
      renderWithProviders(<SettingsPage />)
      const form = await change('vieja contraseña 1', 'nueva frase muy larga')
      await waitFor(() => expect(auth.changePassword).toHaveBeenCalledWith('vieja contraseña 1', 'nueva frase muy larga'))
      await waitFor(() => expect(within(form).getByLabelText('Contraseña actual')).toHaveValue(''))
    })

    it('refuses the same password and a mismatched confirmation', async () => {
      renderWithProviders(<SettingsPage />)
      const form = await change('misma frase muy larga', 'misma frase muy larga', 'otra')
      expect(await within(form).findByText('Debe ser distinta de la actual')).toBeInTheDocument()
      expect(within(form).getByText('Las contraseñas no coinciden')).toBeInTheDocument()
      expect(auth.changePassword).not.toHaveBeenCalled()
    })

    it('marks the current password when it is wrong', async () => {
      auth.changePassword.mockRejectedValue(new ApiError(400, { code: 'INCORRECT_PASSWORD' }))
      renderWithProviders(<SettingsPage />)
      const form = await change('equivocada', 'nueva frase muy larga')
      expect(await within(form).findByText('La contraseña es incorrecta.')).toBeInTheDocument()
      expect(within(form).getByLabelText('Contraseña actual')).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('email notices', () => {
    it('saves a switch at once', async () => {
      renderWithProviders(<SettingsPage />)
      const signIns = await screen.findByRole('switch', { name: 'Inicios de sesión' })
      expect(signIns).not.toBeChecked()
      await userEvent.click(signIns)
      await waitFor(() => expect(signIns).toBeChecked())
      await waitFor(() => expect(api.callsTo('PUT', '/api/v1/notifications/preferences')[0]!.body)
        .toEqual({ emailMoneyIn: true, emailMoneyOut: true, emailSignIns: true }))
    })

    it('moves a refused switch back', async () => {
      api.on('PUT', '/api/v1/notifications/preferences', problem(500, 'INTERNAL_ERROR'))
      renderWithProviders(<SettingsPage />)
      const moneyIn = await screen.findByRole('switch', { name: 'Dinero que recibes' })
      await userEvent.click(moneyIn)
      await waitFor(() => expect(moneyIn).toBeChecked())
    })
  })

  describe('sessions', () => {
    it('lists the devices and closes another one', async () => {
      renderWithProviders(<SettingsPage />)
      expect(await screen.findByText('Este dispositivo')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Cerrar la sesión de Safari/ }))
      await waitFor(() => expect(api.callsTo('DELETE', '/api/v1/users/me/sessions/{sessionId}')[0]!.path)
        .toBe('/api/v1/users/me/sessions/s-2'))
      expect(screen.queryByRole('button', { name: /Cerrar la sesión de Chrome/ })).not.toBeInTheDocument()
    })

    it('closes every other session at once', async () => {
      renderWithProviders(<SettingsPage />)
      await userEvent.click(await screen.findByRole('button', { name: 'Cerrar las demás sesiones' }))
      await waitFor(() => expect(api.callsTo('DELETE', '/api/v1/users/me/sessions')).toHaveLength(1))
    })
  })

  describe('two-factor', () => {
    it('turns it on: password, code from the app, recovery codes, then signs out', async () => {
      api.on('POST', '/api/v1/users/me/two-factor', { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Billetera:ana?secret=JBSWY3DPEHPK3PXP' })
      api.on('POST', '/api/v1/users/me/two-factor/confirm', { recoveryCodes: ['aaaa-1111', 'bbbb-2222'] })
      renderWithProviders(<SettingsPage />)
      await userEvent.click(screen.getByRole('button', { name: 'Activar' }))
      let dialog = await screen.findByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Contraseña actual'), 'mi contraseña')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }))

      expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
      dialog = screen.getByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Código de 6 dígitos de la app'), '123456')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }))

      expect(await screen.findByText('aaaa-1111')).toBeInTheDocument()
      expect(api.callsTo('POST', '/api/v1/users/me/two-factor/confirm')[0]!.body).toEqual({ code: '123456' })
      await userEvent.click(screen.getByRole('button', { name: 'Ya los guardé' }))
      expect(auth.logout).toHaveBeenCalled()
    })

    it('turns it off with the password and a code, and warns about few recovery codes', async () => {
      auth.reset(testUser({ twoFactorEnabled: true }))
      api.on('GET', '/api/v1/users/me/two-factor', { enabled: true, unusedRecoveryCodes: 1 })
      api.on('POST', '/api/v1/users/me/two-factor/disable', json(204))
      renderWithProviders(<SettingsPage />)
      expect(await screen.findByText(/código de recuperación/)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Contraseña actual'), 'mi contraseña')
      await userEvent.type(within(dialog).getByLabelText('Código de la app o de recuperación'), '654321')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))
      await waitFor(() => expect(api.callsTo('POST', '/api/v1/users/me/two-factor/disable')[0]!.body)
        .toEqual({ currentPassword: 'mi contraseña', code: '654321' }))
      expect(auth.refreshUser).toHaveBeenCalled()
    })
  })
})
