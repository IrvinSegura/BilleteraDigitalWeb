import type { Page } from '@playwright/test'

import { createUser, type TestUser } from './support/api'
import { promoteToAdmin } from './support/db'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { newIneData, pngPhoto } from './support/identity'
import { signIn } from './support/ui'

// Identity checks from both sides: customers send their voter card (INE) from their settings, and an administrator
// reviews it in the console, approving one and rejecting the other, which each customer then sees.
test.describe.configure({ mode: 'serial' })

let adminPage: Page
let admin: TestUser
let approved: TestUser
let rejected: TestUser

test.beforeAll(async ({ browser }) => {
  ;[admin, approved, rejected] = await Promise.all([
    createUser('admin', { twoFactor: true }), createUser('identity'), createUser('rejected')])
  promoteToAdmin(admin.email)
  adminPage = await browser.newPage()
  await waitOutRateLimits(adminPage)
  await signIn(adminPage, admin, '/admin')
})

test.afterAll(async () => {
  await adminPage.close()
})

/** Signs the customer in, opens the identity page from their settings and sends a new card. */
async function sendIne(page: Page, user: TestUser) {
  await signIn(page, user)
  await page.goto('/settings')
  await page.getByRole('link', { name: 'Verificar mi identidad' }).click()
  await expect(page).toHaveURL('/settings/identity')
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Aún no verificas tu identidad')

  const [firstNames, firstSurname] = user.fullName.split(' ')
  const ine = newIneData()
  await page.getByLabel('Nombre(s)').fill(firstNames!)
  await page.getByLabel('Primer apellido').fill(firstSurname!)
  await page.getByLabel('CURP', { exact: true }).fill(ine.curp)
  await page.getByLabel('Clave de elector').fill(ine.voterKey)
  await page.getByLabel('Vigencia').fill(ine.expiryYear)
  await page.getByLabel('CIC', { exact: true }).fill(ine.cic)
  await page.getByLabel('Identificador del ciudadano').fill(ine.citizenId)
  await page.locator('#identity-front').setInputFiles(pngPhoto('frente.png'))
  await page.locator('#identity-back').setInputFiles(pngPhoto('reverso.png', [160, 90, 40]))
  await page.locator('#identity-selfie').setInputFiles(pngPhoto('rostro.png', [200, 170, 140]))
  await page.getByRole('button', { name: 'Enviar para revisión' }).click()

  await expect(page.getByRole('main').getByRole('status')).toHaveText('Estamos revisando tu INE')
  // Sent once: the form is gone until a review asks for another
  await expect(page.getByRole('button', { name: 'Enviar para revisión' })).toHaveCount(0)
  return ine
}

/** Opens the customer's verification from the console's queue. */
async function openReview(user: TestUser) {
  await adminPage.goto('/admin')
  await adminPage.locator('a[href="/admin/identity"]').first().click()
  await expect(adminPage.getByRole('heading', { level: 1, name: 'Verificación de identidad' })).toBeVisible()
  const row = adminPage.getByRole('row').filter({ hasText: user.email })
  await row.getByRole('link').click()
  await expect(adminPage).toHaveURL(/\/admin\/identity\/[0-9a-f-]{36}$/)
}

test('a customer sends their INE and an administrator approves it', async ({ page }) => {
  const ine = await sendIne(page, approved)

  await openReview(approved)
  await expect(adminPage.getByText(ine.curp)).toBeVisible()
  await expect(adminPage.getByText(ine.voterKey)).toBeVisible()
  // The three pictures arrive and can be looked at
  for (const side of ['Frente de la INE', 'Reverso de la INE', 'Tu rostro']) {
    await expect(adminPage.getByRole('img', { name: side })).toBeVisible()
  }

  await adminPage.getByRole('button', { name: 'Aprobar' }).click()
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click()
  await expect(adminPage.getByText('Identidad aprobada.')).toBeVisible()
  await expect(adminPage.getByRole('button', { name: 'Aprobar' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Tu identidad está verificada')
  await page.goto('/settings')
  await expect(page.getByText('Verificada', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver verificación' })).toBeVisible()
})

test('a rejected INE shows the reason and can be sent again', async ({ page }) => {
  await sendIne(page, rejected)

  await openReview(rejected)
  await adminPage.getByRole('button', { name: 'Rechazar' }).click()
  const dialog = adminPage.getByRole('dialog')
  await dialog.getByLabel('Motivo').fill('Prueba E2E: la foto del frente no se lee')
  await dialog.getByRole('button', { name: 'Rechazar' }).click()
  await expect(dialog).toBeHidden()
  await expect(adminPage.getByText('Prueba E2E: la foto del frente no se lee')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('main').getByRole('status')).toHaveText('No pudimos verificar tu identidad')
  await expect(page.getByText(/Prueba E2E: la foto del frente no se lee/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar para revisión' })).toBeVisible()
})
