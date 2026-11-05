import { createUser, type TestUser } from './support/api'
import { expect, test } from './support/fixtures'
import { signIn, submitSignIn } from './support/ui'

let user: TestUser

test.beforeAll(async () => {
  user = await createUser('resilience')
})

test('a screen whose code is gone after a release reloads once, then offers a reload', async ({ page }) => {
  await signIn(page, user)

  // The wallets screen loads on demand; dev serves it as /src/…/WalletsPage.tsx, a build as /assets/WalletsPage-<hash>.js
  const walletsChunk = (url: URL) => /\/WalletsPage[-.]/.test(url.pathname)
  await page.route(walletsChunk, (route) => route.abort())
  const reloaded = page.waitForEvent('load')

  await page.getByRole('link', { name: 'Billeteras' }).first().click()

  await reloaded
  await expect(page.getByRole('heading', { name: 'Hay una nueva versión disponible' })).toBeVisible()
  // Only the page failed: the navigation still works
  await expect(page.getByRole('link', { name: 'Inicio' }).first()).toBeVisible()

  await page.unroute(walletsChunk)
  await page.getByRole('button', { name: 'Recargar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Billeteras' })).toBeVisible()
})

test('a page that fails to render shows an error screen and the rest of the app keeps working', async ({ page }) => {
  // An answer the screen doesn't expect makes the dashboard throw while rendering
  await page.route('**/api/v1/wallets', (route) => route.fulfill({ json: { unexpected: true } }))
  await submitSignIn(page, user)

  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()

  await page.getByRole('link', { name: 'Cuentas bancarias' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cuentas bancarias' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toBeHidden()
})
