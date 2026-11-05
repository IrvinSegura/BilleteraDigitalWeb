import { defineConfig, devices } from '@playwright/test'

import { BASE_URL } from './e2e/support/env.ts'

/**
 * `npm run test:e2e`: the real app against the local API (`./mvnw spring-boot:run` in the backend repo, with
 * `docker compose up -d` for its database and Mailpit). Every test creates its own users, so runs don't depend
 * on each other or on existing data.
 */
export default defineConfig({
  testDir: 'e2e',
  // One at a time: the API rate-limits sign-ins per address, and every test signs in from localhost
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  // Long enough for an auth request that waits out the API's rate limit (see e2e/support/fixtures.ts)
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  // The dev server on port 3000, where the API's email links point; one already running is reused
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
