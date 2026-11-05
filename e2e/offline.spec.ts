import { createUser } from './support/api'
import { expect, test } from './support/fixtures'
import { mxn, signIn } from './support/ui'

// The service worker only exists in the production build: run against `npm run build && npm run preview` with
// E2E_PREVIEW=1 (see the README)
test.skip(!process.env.E2E_PREVIEW, 'needs the production build')

test('opens offline with the last data seen, and forgets it on sign-out', async ({ page, context }) => {
  const user = await createUser('pwa')
  await signIn(page, user)
  await expect(page.getByText('Saldo disponible')).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The snapshot is written a few seconds after the data arrives
  await page.waitForTimeout(4000)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Sin conexión.')).toBeVisible()
  await expect(page.getByText(/Estás viendo la información guardada el/)).toBeVisible()
  await expect(page.getByText('Saldo disponible').locator('xpath=following-sibling::p')).toHaveText(mxn(0))

  await context.setOffline(false)
  await expect(page.getByText(/Estás viendo la información guardada/)).toBeHidden()
  await expect(page.getByText('Saldo disponible')).toBeVisible()

  expect(await page.evaluate(() => localStorage.getItem('wallet.offline'))).not.toBeNull()
  await page.getByRole('button', { name: /Menú de la cuenta|Prueba Pwa/ }).first().click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect(await page.evaluate(() => localStorage.getItem('wallet.offline'))).toBeNull()
})
