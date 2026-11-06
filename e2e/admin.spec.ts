import type { Page } from '@playwright/test'

import { apiCall, createUser, mxnWallet, type TestUser } from './support/api'
import { promoteToAdmin } from './support/db'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// The administration console as a support person uses it: find a customer, freeze and unfreeze their wallet,
// disable and enable the account, and see it all in the audit log. One admin session for the whole story.
test.describe.configure({ mode: 'serial' })

let page: Page
let admin: TestUser
let customer: TestUser

test.beforeAll(async ({ browser }) => {
  // The console needs an administrator who signed in with a two-factor code
  ;[admin, customer] = await Promise.all([createUser('admin', { twoFactor: true }), createUser('customer')])
  promoteToAdmin(admin.email)
  page = await browser.newPage()
  await waitOutRateLimits(page)
  await signIn(page, admin)
})

test.afterAll(async () => {
  await page.close()
})

async function confirmWithReason(action: string, reason: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Motivo').fill(reason)
  await dialog.getByRole('button', { name: action }).click()
  await expect(dialog).toBeHidden()
}

test('finds a customer by email and shows their wallets', async () => {
  await page.getByRole('link', { name: 'Usuarios' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible()

  // Matches show up as it is typed; picking one opens the account
  await page.getByLabel('Correo, nombre o ID del usuario').fill(customer.email)
  await page.getByRole('option', { name: new RegExp(customer.email.replace(/[.]/g, '\\.')) }).click()

  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/)
  await expect(page.getByText(customer.fullName).first()).toBeVisible()
  const wallets = page.getByRole('table')
  await expect(wallets.getByRole('cell', { name: /^MXN/ })).toBeVisible()
  await expect(wallets.getByText('Activa')).toBeVisible()
})

test('freezes the wallet, which the customer sees, then unfreezes it', async () => {
  await page.getByRole('button', { name: 'Congelar' }).click()
  await confirmWithReason('Congelar', 'Prueba E2E: revisión de movimientos')
  await expect(page.getByRole('table').getByText('Congelada')).toBeVisible()
  expect((await mxnWallet(customer)).status).toBe('FROZEN')

  await page.getByRole('button', { name: 'Descongelar' }).click()
  await confirmWithReason('Descongelar', 'Prueba E2E: revisión terminada')
  await expect(page.getByRole('table').getByText('Activa')).toBeVisible()
  expect((await mxnWallet(customer)).status).toBe('ACTIVE')
})

test('disables the account so it cannot sign in, then enables it', async () => {
  await page.getByRole('button', { name: 'Deshabilitar' }).click()
  await confirmWithReason('Deshabilitar', 'Prueba E2E: cuenta en revisión')
  await expect(page.getByText('Deshabilitada')).toBeVisible()
  await expect(apiCall('POST', '/api/v1/auth/login', { data: { email: customer.email, password: customer.password } }))
    .rejects.toThrow(/ACCOUNT_DISABLED/)

  await page.getByRole('button', { name: 'Habilitar' }).click()
  await confirmWithReason('Habilitar', 'Prueba E2E: revisión terminada')
  await expect(page.getByText('Deshabilitada')).toBeHidden()
  await apiCall('POST', '/api/v1/auth/login', { data: { email: customer.email, password: customer.password } })
})

test('records every action with its reason in the audit log', async () => {
  await page.getByRole('link', { name: 'Auditoría' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible()

  for (const action of ['Billetera congelada', 'Billetera descongelada', 'Cuenta deshabilitada', 'Cuenta habilitada']) {
    await expect(page.getByRole('cell', { name: action }).first()).toBeVisible()
  }
  // The detail is in its own column on wide screens and under the action on narrow ones
  await expect(page.getByText('Motivo: Prueba E2E: revisión de movimientos').filter({ visible: true }).first()).toBeVisible()
})

test('browses the accounts by role, and the list survives opening one', async () => {
  await page.locator('a[href="/admin/users"]').first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible()
  await expect(page.getByLabel('Resumen de cuentas').getByText('Administradores')).toBeVisible()

  await page.getByRole('group', { name: 'Rol' }).getByRole('button', { name: 'Administrador' }).click()
  await expect(page).toHaveURL('/admin/users?role=ADMIN')
  // Every test administrator has this name, and the newest comes first
  await expect(page.getByRole('link', { name: admin.fullName }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: customer.fullName })).toHaveCount(0)

  await page.getByRole('link', { name: admin.fullName }).first().click()
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/)
  await page.goBack()
  await expect(page).toHaveURL('/admin/users?role=ADMIN')
  await expect(page.getByRole('group', { name: 'Rol' }).getByRole('button', { name: 'Administrador' })).toHaveAttribute('aria-pressed', 'true')
})

test('browses the wallets by status and reaches the owner of one', async () => {
  const wallet = await mxnWallet(customer)
  await page.locator('a[href="/admin/wallets"]').first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Billeteras' })).toBeVisible()
  const row = page.getByRole('row').filter({ has: page.locator(`[title="${wallet.id}"]`) })

  await page.getByRole('group', { name: 'Estado de la billetera' }).getByRole('button', { name: 'Congelada' }).click()
  await expect(page).toHaveURL('/admin/wallets?status=FROZEN')
  await expect(row).toHaveCount(0)

  await page.getByRole('group', { name: 'Estado de la billetera' }).getByRole('button', { name: 'Activa' }).click()
  await expect(row.getByText('Activa')).toBeVisible()
  await row.getByRole('link').click()
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/)
  await expect(page.getByText(customer.fullName).first()).toBeVisible()
})

test('keeps the console away from customers', async ({ browser }) => {
  const customerPage = await browser.newPage()
  await waitOutRateLimits(customerPage)
  await signIn(customerPage, customer)
  await customerPage.goto('/admin/users')
  await expect(customerPage).toHaveURL('/')
  await expect(customerPage.getByRole('link', { name: 'Auditoría' })).toHaveCount(0)
  await customerPage.close()
})
