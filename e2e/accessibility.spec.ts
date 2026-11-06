import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

import { createUser, type TestUser } from './support/api'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// WCAG 2.1 A and AA, what a public financial app is usually held to
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** The page's accessibility violations, one line each, so a failure says what to fix and where. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

test.describe('accessibility', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page
  let user: TestUser

  test('the sign-in screen has no violations', async ({ page: guest }) => {
    await guest.goto('/login')
    await expect(guest.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
    expect(await violations(guest)).toEqual([])
  })

  test.describe('signed in', () => {
    test.beforeAll(async ({ browser }) => {
      user = await createUser('a11y')
      // axe needs a page of its own context, not browser.newPage()'s
      page = await (await browser.newContext()).newPage()
      await waitOutRateLimits(page)
      await signIn(page, user)
    })

    test.afterAll(async () => {
      await page.context().close()
    })

    for (const [name, path, ready] of [
      ['dashboard', '/', 'Saldo disponible'],
      ['wallets', '/wallets', 'Billeteras'],
      ['statements', '/statements', 'Por billetera'],
      ['notifications', '/notifications', 'Notificaciones'],
      ['settings', '/settings', 'Sesiones activas'],
      ['support', '/support', 'Soporte'],
    ] as const) {
      test(`the ${name} has no violations`, async () => {
        await page.goto(path)
        await expect(page.getByText(ready).first()).toBeVisible()
        // The page itself, not its loading placeholders
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
        expect(await violations(page)).toEqual([])
      })
    }

    test('the transfer and request dialogs have no violations', async () => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Enviar', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(await violations(page)).toEqual([])
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: 'Cobrar', exact: true }).click()
      await expect(page.getByRole('dialog').getByRole('img', { name: /Código QR/ })).toBeVisible()
      expect(await violations(page)).toEqual([])
    })
  })
})
