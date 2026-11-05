import { expect, type Page } from '@playwright/test'

import type { TestUser } from './api'
import { nextTotp } from './totp'

/** Fills in the login screen and sends it, with the authenticator step when the user has two-factor on. */
export async function submitSignIn(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  if (user.twoFactorSecret) {
    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible()
    await page.getByLabel('Código de verificación').fill(await nextTotp(user.twoFactorSecret))
    await page.getByRole('button', { name: 'Verificar y entrar' }).click()
  }
}

/** Signs in through the login screen and waits for the dashboard. */
export async function signIn(page: Page, user: TestUser) {
  await submitSignIn(page, user)
  await expect(page.getByRole('heading', { level: 1, name: user.fullName.split(' ')[0] })).toBeVisible()
  await expect(page).toHaveURL('/')
}

/** Formats an amount as the app shows it in Mexico, e.g. 1250 → "$1,250.00". */
export function mxn(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
