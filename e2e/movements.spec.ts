import type { Page } from '@playwright/test'

import { createUser, deposit, mxnWallet, transfer, type TestUser } from './support/api'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// One session for all of them: signing in once keeps the run within the API's sign-in rate limit
test.describe.configure({ mode: 'serial' })

let page: Page
let sender: TestUser
let recipient: TestUser
let other: TestUser

// By their signed amount, which the buttons of the filters don't have
const rows = () => page.getByRole('button', { name: /[−+]\$\d/ })

// The list of previews hides the rest of the page from the accessibility tree while it is open
async function search(text: string) {
  await page.getByRole('combobox', { name: 'Buscar' }).fill(text)
  await page.keyboard.press('Escape')
}

test.beforeAll(async ({ browser }) => {
  ;[sender, recipient, other] = await Promise.all([createUser('sender'), createUser('recipient'), createUser('other')])
  await deposit(sender, 1000)
  await transfer(sender, recipient, 100, 'Cena del viernes')
  await transfer(sender, other, 50, 'Renta de noviembre')
  page = await browser.newPage()
  await waitOutRateLimits(page)
  await signIn(page, sender)
  await page.goto(`/wallets/${(await mxnWallet(sender)).id}`)
  await expect(rows()).toHaveCount(3)
})

test.afterAll(async () => {
  await page.close()
})

test('shows who each transfer was with and its concept', async () => {
  const dinner = page.getByRole('button', { name: /Cena del viernes/ })

  await expect(dinner).toContainText(recipient.fullName)
  await expect(dinner).toContainText('Transferencia enviada')
  await expect(page.getByRole('button', { name: /Depósito/ })).not.toContainText(' · ')
})

test('searches by concept, without minding case or accents', async () => {
  await page.getByRole('button', { name: /^Filtrar/ }).click()
  await search('RENTÁ')

  await expect(rows()).toHaveCount(1)
  await expect(rows()).toContainText(other.fullName)
})

test('searches by the other person', async () => {
  await search(recipient.fullName)

  await expect(rows()).toHaveCount(1)
  await expect(rows()).toContainText('Cena del viernes')
})

test('picking a preview narrows the list to that movement by its folio', async () => {
  const field = page.getByRole('combobox', { name: 'Buscar' })
  await field.fill('renta')
  await page.getByRole('option', { name: new RegExp(other.fullName) }).click()

  await expect(field).toHaveValue(/^[0-9a-f-]{36}$/)
  await expect(rows()).toHaveCount(1)
  await expect(rows()).toContainText('Renta de noviembre')
})

test('the statement says who and why under the kind of movement', async () => {
  await page.goto(`/wallets/${(await mxnWallet(sender)).id}/statement`)

  const row = page.getByRole('row', { name: /Cena del viernes/ })
  await expect(row).toContainText('Transferencia enviada')
  await expect(row).toContainText(`${recipient.fullName} · Cena del viernes`)
})

test('a long concept is cut instead of widening the page on a phone', async () => {
  await transfer(sender, recipient, 10, 'Cena del viernes con todo el equipo de la oficina y sus familias, otra vez')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/wallets/${(await mxnWallet(sender)).id}`)
  await expect(page.getByRole('button', { name: /otra vez/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)

  await page.goto('/')
  await expect(page.getByRole('button', { name: /otra vez/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
})
