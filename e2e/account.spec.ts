import type { Page } from '@playwright/test'

import { apiCall, createUser, deposit, transfer, type TestUser } from './support/api'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// The account screens: profile, email notices, sessions, notifications, bank accounts and the password, in one
// session that ends by changing the password.
test.describe.configure({ mode: 'serial' })

// Valid check digit, Banamex's bank code (002)
const CLABE = '002010077777777771'

let page: Page
let user: TestUser
let payer: TestUser

test.beforeAll(async ({ browser }) => {
  ;[user, payer] = await Promise.all([createUser('account'), createUser('payer')])
  page = await browser.newPage()
  await waitOutRateLimits(page)
  await signIn(page, user)
})

test.afterAll(async () => {
  await page.close()
})

test('edits the name and phone, which the API keeps in E.164', async () => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Editar' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre completo').fill('Prueba Cuenta Editada')
  await dialog.getByLabel('Teléfono (opcional)').fill('+52 55 1234 5678')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()

  await expect(page.getByText('+525512345678')).toBeVisible()
  const me = await apiCall<{ fullName: string; phone: string }>('GET', '/api/v1/users/me', { token: user.token })
  expect(me).toMatchObject({ fullName: 'Prueba Cuenta Editada', phone: '+525512345678' })
})

test('keeps the email notice choices after a reload', async () => {
  const signIns = page.getByRole('switch', { name: 'Inicios de sesión' })
  const before = await signIns.isChecked()
  await signIns.click()
  await expect(signIns).toBeChecked({ checked: !before })
  // The switch moves at once; wait for the API to have it before reloading
  await expect.poll(async () => (await apiCall<{ emailSignIns: boolean }>(
    'GET', '/api/v1/notifications/preferences', { token: user.token })).emailSignIns).toBe(!before)

  await page.reload()
  await expect(page.getByRole('switch', { name: 'Inicios de sesión' })).toBeChecked({ checked: !before })
})

test('lists the other sessions and closes them all', async () => {
  // createUser signed in through the API: that is another session besides this browser
  await expect(page.getByText('Este dispositivo')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar las demás sesiones' }).click()
  await expect(page.getByRole('button', { name: 'Cerrar las demás sesiones' })).toBeHidden()
  await expect(page.getByRole('button', { name: /^Cerrar la sesión de/ })).toHaveCount(0)
})

test('shows a received transfer in the notifications and marks them read', async () => {
  await deposit(payer, 300)
  await transfer(payer, user, 125, 'Prueba notificación')

  await page.getByRole('link', { name: 'Notificaciones' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Notificaciones' })).toBeVisible()
  await expect(page.getByText('Dinero recibido').first()).toBeVisible()

  await page.getByRole('button', { name: 'Marcar todo como leído' }).click()
  await expect(page.getByRole('button', { name: 'Marcar todo como leído' })).toBeHidden()
  await page.getByRole('group', { name: 'Mostrar' }).getByRole('button', { name: /^Sin leer/ }).click()
  await expect(page.getByText('Estás al día')).toBeVisible()
})

test('removes a bank account', async () => {
  await apiCall('POST', '/api/v1/bank-accounts', { token: user.token, data: { clabe: CLABE, holderName: 'Prueba Cuenta' } })
  await page.getByRole('link', { name: 'Cuentas bancarias' }).first().click()
  await page.getByRole('button', { name: `Eliminar la cuenta terminación ${CLABE.slice(-4)}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText('Sin cuentas bancarias')).toBeVisible()
})

test('changes the password: the new one signs in and the old one no longer does', async () => {
  const newPassword = `${user.password}-nueva`
  await page.goto('/settings')
  await page.getByLabel('Contraseña actual').fill(user.password)
  await page.getByLabel('Nueva contraseña').fill(newPassword)
  await page.getByLabel('Confírmala').fill(newPassword)
  await page.getByRole('button', { name: 'Actualizar contraseña' }).click()
  // The form empties once the API took it, and this session stays signed in
  await expect(page.getByLabel('Contraseña actual')).toHaveValue('')
  await expect(page).toHaveURL('/settings')

  await apiCall('POST', '/api/v1/auth/login', { data: { email: user.email, password: newPassword } })
  await expect(apiCall('POST', '/api/v1/auth/login', { data: { email: user.email, password: user.password } }))
    .rejects.toThrow(/INVALID_CREDENTIALS/)
})
