import { test as base, type Page } from '@playwright/test'

export { expect } from '@playwright/test'

/**
 * Sends the page's auth requests (sign-in, sign-up, session refresh, email links) again when the API's
 * per-address rate limit refuses them. Every test runs from localhost, which a real user never shares with
 * dozens of others; a refused request changes nothing on the API, so sending it again is safe. The request goes
 * through the browser context, so the refresh cookie is sent and the rotated one kept.
 */
export async function waitOutRateLimits(page: Page) {
  await page.route('**/api/v1/auth/**', async (route) => {
    for (let attempt = 0; ; attempt++) {
      const response = await route.fetch()
      if (response.status() !== 429 || attempt === 6) {
        await route.fulfill({ response })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, (Number(response.headers()['retry-after']) || 5) * 1000))
    }
  })
}

/** Playwright's test, with every page waiting out the API's rate limit. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await waitOutRateLimits(page)
    await use(page)
  },
})
