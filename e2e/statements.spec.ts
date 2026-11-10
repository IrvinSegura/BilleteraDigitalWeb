import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'

import { createUser, deposit, mxnWallet, transfer, type TestUser } from './support/api'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// One session for all of them: signing in once keeps the run within the API's sign-in rate limit
test.describe.configure({ mode: 'serial' })

let page: Page
let owner: TestUser

const month = () => new Date().toISOString().slice(0, 7)

async function downloadedPdf(click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download'), click()])
  const bytes = await readFile((await download.path())!)
  return { name: download.suggestedFilename(), bytes }
}

test.beforeAll(async ({ browser }) => {
  let other: TestUser
  ;[owner, other] = await Promise.all([createUser('statement'), createUser('statement-peer')])
  await deposit(owner, 800)
  await transfer(owner, other, 120, 'Renta de noviembre')
  page = await browser.newPage()
  await waitOutRateLimits(page)
  await signIn(page, owner)
})

test.afterAll(async () => {
  await page?.close()
})

test("the statements page sums each wallet's month", async () => {
  await page.goto('/statements')
  await page.getByRole('link', { name: 'Estados de cuenta' }).first().waitFor()

  await expect(page.getByText('+$800.00')).toBeVisible()
  await expect(page.getByText('−$120.00')).toBeVisible()
  await expect(page.getByText('$680.00')).toBeVisible()
})

test('downloads the general statement as a PDF', async () => {
  const pdf = await downloadedPdf(() => page.getByRole('button', { name: 'Descargar estado general' }).click())

  expect(pdf.name).toBe(`estado-de-cuenta-general-${month()}.pdf`)
  expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  await expect(page.getByText('Estado de cuenta descargado.')).toBeVisible()
})

test("downloads one wallet's statement from its own page", async () => {
  await page.goto(`/wallets/${(await mxnWallet(owner)).id}/statement`)
  await expect(page.getByText('Renta de noviembre', { exact: false })).toBeVisible()

  const pdf = await downloadedPdf(() => page.getByRole('button', { name: 'Descargar PDF' }).click())

  expect(pdf.name).toBe(`estado-de-cuenta-mxn-${month()}.pdf`)
  expect(pdf.bytes.length).toBeGreaterThan(2000)
})

test('only offers periods since the first record', async () => {
  await page.goto('/statements')
  // Everything of this user happened today: no earlier month, nor the three together
  const picker = page.getByRole('combobox', { name: 'Periodo' })
  await picker.click()
  await expect(page.getByRole('option')).toHaveText(['Último mes', 'Elegir fechas'])
  await page.getByRole('option', { name: 'Elegir fechas' }).click()

  // The calendar opens on this month alone, with today the only day to pick
  const calendar = page.getByRole('dialog', { name: 'Fechas del estado de cuenta' })
  const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'))
  await expect(calendar.getByRole('grid')).toHaveCount(1)
  await expect(calendar.getByRole('button', { name: 'Mes anterior' })).toBeDisabled()
  await expect(calendar.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
  await expect(calendar.locator(`[data-date="${today}"]`)).not.toHaveAttribute('aria-disabled', 'true')
  await expect(calendar.locator('[data-date]:not([aria-disabled])')).toHaveCount(1)

  await calendar.locator(`[data-date="${today}"]`).click()
  await calendar.locator(`[data-date="${today}"]`).click()
  await calendar.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page).toHaveURL(`/statements?from=${today}&to=${today}`)
})
