import type { Page } from '@playwright/test'

import { createUser, mxnBalance, type TestUser } from './support/api'
import { promoteToAdmin } from './support/db'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// Manual credits and debits to a customer's wallet. A small one applies at once; above the API's single-approval
// limit (1,000.00 MXN locally) it waits for a second administrator, since the one who asked can't approve it, only
// withdraw it. Two administrators, each with their own session.
test.describe.configure({ mode: 'serial' })

let page: Page
let second: Page
let admin: TestUser
let colleague: TestUser
let customer: TestUser
let largeAdjustment: string
let customerAccount: string | undefined
const run = Date.now()

test.beforeAll(async ({ browser }) => {
  ;[admin, colleague, customer] = await Promise.all([
    createUser('admin', { twoFactor: true }), createUser('admin', { twoFactor: true }), createUser('customer')])
  promoteToAdmin(admin.email)
  promoteToAdmin(colleague.email)
  ;[page, second] = await Promise.all([browser.newPage(), browser.newPage()])
  await Promise.all([waitOutRateLimits(page), waitOutRateLimits(second)])
  await signIn(page, admin, '/admin')
  await signIn(second, colleague, '/admin')
})

test.afterAll(async () => {
  await Promise.all([page.close(), second.close()])
})

/**
 * Opens the customer's account in the console and starts an adjustment of their MXN wallet. The first time it is
 * found by email; the search keeps that text afterwards, so later adjustments go back to the account's address.
 */
async function adjust(direction: 'Abono' | 'Cargo', amount: string, reason: string) {
  if (customerAccount) {
    await page.goto(customerAccount)
  } else {
    await page.locator('a[href="/admin/users"]').first().click()
    await page.getByLabel('Correo, nombre o ID del usuario').fill(customer.email)
    await page.getByRole('option', { name: new RegExp(customer.email.replace(/[.]/g, '\\.')) }).click()
    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/)
    customerAccount = page.url()
  }

  await page.getByRole('button', { name: 'Ajustar saldo' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: direction }).click()
  await dialog.getByLabel('Monto').fill(amount)
  await dialog.getByLabel('Motivo').fill(reason)
  // The amount is on the button: this moves a customer's money
  await dialog.getByRole('button', { name: new RegExp(`^${direction === 'Abono' ? 'Abonar' : 'Cargar'} \\$`) }).click()
  await expect(dialog).toBeHidden()
}

test('a credit within the limit applies at once', async () => {
  await adjust('Abono', '150', `Prueba E2E ${run}: compensación por cargo duplicado`)

  await expect(page.getByText('Ajuste aplicado.')).toBeVisible()
  expect(await mxnBalance(customer)).toBe('150.00')
})

test('a large credit waits, and whoever asked for it can only withdraw it', async () => {
  const reason = `Prueba E2E ${run}: reembolso grande`
  await adjust('Abono', '2500', reason)

  await expect(page.getByText('El ajuste quedó en espera de otro administrador.')).toBeVisible()
  expect(await mxnBalance(customer)).toBe('150.00')

  await page.locator('a[href="/admin/adjustments"]').first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes de saldo' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: reason })
  await expect(row.getByText('+$2,500.00 MXN')).toBeVisible()
  await row.getByRole('link').click()
  await expect(page).toHaveURL(/\/admin\/adjustments\/[0-9a-f-]{36}$/)
  largeAdjustment = page.url()

  await expect(page.getByText('Por aprobar')).toBeVisible()
  await expect(page.getByText(/Tú lo solicitaste: otro administrador debe aprobarlo/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retirar mi solicitud' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aprobar y aplicar' })).toHaveCount(0)
})

test('a second administrator approves it and the money arrives', async () => {
  await second.goto(largeAdjustment)
  await expect(second.getByText('Este monto necesita la aprobación de un segundo administrador.')).toBeVisible()

  await second.getByRole('button', { name: 'Aprobar y aplicar' }).click()
  await second.getByRole('dialog').getByRole('button', { name: 'Aprobar y aplicar' }).click()

  await expect(second.getByText('Aplicado', { exact: true })).toBeVisible()
  await expect(second.getByRole('button', { name: 'Aprobar y aplicar' })).toHaveCount(0)
  expect(await mxnBalance(customer)).toBe('2650.00')
})

test('a withdrawn request moves no money', async () => {
  await adjust('Cargo', '1500', `Prueba E2E ${run}: cargo que se retira`)
  await expect(page.getByText('El ajuste quedó en espera de otro administrador.')).toBeVisible()

  await page.locator('a[href="/admin/adjustments"]').first().click()
  await page.getByRole('row').filter({ hasText: 'cargo que se retira' }).getByRole('link').click()
  await page.getByRole('button', { name: 'Retirar mi solicitud' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Motivo').fill('Prueba E2E: ya no hace falta')
  await dialog.getByRole('button', { name: 'Retirar mi solicitud' }).click()
  await expect(dialog).toBeHidden()

  await expect(page.getByText('Rechazado', { exact: true })).toBeVisible()
  await expect(page.getByText('Prueba E2E: ya no hace falta')).toBeVisible()
  expect(await mxnBalance(customer)).toBe('2650.00')
})
