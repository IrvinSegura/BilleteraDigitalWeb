import type { Page } from '@playwright/test'

import { createUser, mxnBalance, type TestUser } from './support/api'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { mxn, signIn } from './support/ui'

// One session for the whole story: money deposited is then sent, then held for withdrawal. Each step builds on
// the previous one, and signing in once keeps the run within the API's sign-in rate limit.
test.describe.configure({ mode: 'serial' })

// Valid check digit, BBVA's bank code (012)
const CLABE = '012180001234567899'

let page: Page
let sender: TestUser
let recipient: TestUser

const balance = () => page.getByText('Saldo disponible').locator('xpath=following-sibling::p')
// As the API shows a recipient before the transfer: first name and initials, "Prueba R."
const shortName = (fullName: string) => fullName.split(' ').map((part, i) => (i === 0 ? part : `${part[0]}.`)).join(' ')

test.beforeAll(async ({ browser }) => {
  ;[sender, recipient] = await Promise.all([createUser('sender'), createUser('recipient')])
  page = await browser.newPage()
  await waitOutRateLimits(page)
  await signIn(page, sender)
})

test.afterAll(async () => {
  await page.close()
})

test('deposits money into the wallet', async () => {
  await page.getByRole('button', { name: 'Depositar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Monto').fill('1500')
  await expect(dialog.getByText('Sin comisión')).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuar al pago' }).click()

  // The local API's simulated provider pays the checkout at once
  await expect(dialog.getByText('Depositaste')).toBeVisible()
  await expect(dialog.getByText(`Tu nuevo saldo es ${mxn(1500)}`)).toBeVisible()
  await dialog.getByRole('button', { name: 'Listo' }).click()

  await expect(balance()).toHaveText(mxn(1500))
})

test('sends money to another user, confirming with the password the first time', async () => {
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Correo de quien recibe').fill(recipient.email)
  await dialog.getByLabel('Monto').fill('250')
  await dialog.getByLabel('Concepto (opcional)').fill('Prueba E2E')
  await dialog.getByRole('button', { name: 'Continuar' }).click()

  await expect(dialog.getByRole('heading', { name: 'Confirma el envío' })).toBeVisible()
  // The review names who the email belongs to, shortened, so a mistyped email shows before the money leaves
  await expect(dialog.getByText(shortName(recipient.fullName), { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Enviar ahora' }).click()

  // A first transfer to someone asks the sender to prove it's them; without two-factor, with the password
  await expect(dialog.getByText('Confirma que eres tú')).toBeVisible()
  await dialog.getByLabel('Contraseña', { exact: true }).fill(sender.password)
  await dialog.getByRole('button', { name: 'Confirmar y enviar' }).click()

  await expect(dialog.getByText(`Enviaste a ${recipient.fullName}`)).toBeVisible()
  await dialog.getByRole('button', { name: 'Listo' }).click()

  await expect(balance()).toHaveText(mxn(1250))
  expect(await mxnBalance(recipient)).toBe('250.00')
})

test('offers the people paid before and checks an unknown email before the review', async () => {
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: shortName(recipient.fullName) }).click()
  await expect(dialog.getByLabel('Correo de quien recibe')).toHaveValue(recipient.email)

  await dialog.getByLabel('Correo de quien recibe').fill('nadie-existe@wallet.local')
  await dialog.getByLabel('Monto').fill('10')
  await dialog.getByRole('button', { name: 'Continuar' }).click()
  await expect(dialog.getByText('No encontramos una billetera en MXN con ese correo')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('shows the receipt of a movement', async () => {
  await page.getByRole('button', { name: /Transferencia enviada/ }).first().click()
  await page.getByRole('dialog').getByRole('link', { name: 'Ver comprobante' }).click()

  await expect(page.getByRole('heading', { name: 'Comprobante de operación' })).toBeVisible()
  await expect(page.getByText(`−${mxn(250)}`)).toBeVisible()
  await expect(page.getByText(`${recipient.fullName} (${recipient.email})`)).toBeVisible()
  await expect(page.getByText('Prueba E2E')).toBeVisible()
  await page.getByRole('link', { name: 'Volver' }).click()
})

test('opens a payment link as a transfer filled in for review', async () => {
  await page.goto(`/send?to=${encodeURIComponent(recipient.email)}&amount=42.50&concept=Cobro%20E2E`)

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Pagar un cobro' })).toBeVisible()
  await expect(dialog.getByLabel('Correo de quien recibe')).toHaveValue(recipient.email)
  await expect(dialog.getByLabel('Monto')).toHaveValue('42.50')
  await expect(dialog.getByLabel('Concepto (opcional)')).toHaveValue('Cobro E2E')
  await expect(page).toHaveURL('/')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('refuses to send more than the balance', async () => {
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Correo de quien recibe').fill(recipient.email)
  await dialog.getByLabel('Monto').fill('5000')

  await expect(dialog.getByText(`Supera tu saldo disponible: ${mxn(1250)}`)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('adds a bank account and holds withdrawals to it for 24 hours', async () => {
  await page.getByRole('link', { name: 'Cuentas bancarias' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas bancarias' })).toBeVisible()

  await page.getByRole('button', { name: 'Agregar cuenta' }).click()
  const addDialog = page.getByRole('dialog')
  await addDialog.getByLabel('CLABE interbancaria').fill(CLABE)
  await addDialog.getByLabel('Titular de la cuenta').fill(sender.fullName)
  await addDialog.getByRole('button', { name: 'Guardar cuenta' }).click()
  await expect(addDialog).toBeHidden()
  await expect(page.getByText(`•• ${CLABE.slice(-4)}`)).toBeVisible()

  await page.getByRole('link', { name: 'Inicio' }).first().click()
  await page.getByRole('button', { name: 'Retirar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const account = dialog.getByRole('radio', { name: new RegExp(`•• ${CLABE.slice(-4)}`) })
  await expect(dialog.getByText('En espera')).toBeVisible()
  // The only account comes picked, even while it waits
  await expect(account).toBeChecked()
  await dialog.getByLabel('Monto').fill('100')

  // A new account can't receive withdrawals yet, so someone who took over the session can't empty the wallet
  await expect(dialog.getByText(/^Por seguridad, esta cuenta recibe retiros a partir del/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Continuar' })).toBeDisabled()
})
