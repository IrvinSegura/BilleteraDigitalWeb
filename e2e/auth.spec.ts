import { createUser, newUserDetails, type TestUser } from './support/api'
import { expect, test } from './support/fixtures'
import { emailedLink } from './support/mailpit'
import { totp } from './support/totp'
import { signIn, submitSignIn } from './support/ui'

test.describe('sign-in with two-factor', () => {
  let user: TestUser

  test.beforeAll(async () => {
    user = await createUser('twofactor', { twoFactor: true })
  })

  test('signs in with the password and an authenticator code', async ({ page }) => {
    await signIn(page, user)

    await expect(page.getByText('Saldo disponible')).toBeVisible()
  })

  test('refuses a wrong authenticator code and stays on the code step', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill(user.email)
    await page.getByLabel('Contraseña', { exact: true }).fill(user.password)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible()

    // Off by one from the real code, so it can't be accepted by chance
    const wrong = String((Number(totp(user.twoFactorSecret!)) + 1) % 1_000_000).padStart(6, '0')
    const code = page.getByLabel('Código de verificación')
    await code.fill(wrong)
    await page.getByRole('button', { name: 'Verificar y entrar' }).click()

    // The API answers a wrong code like a wrong password; on this step the screen says it was the code
    await expect(page.getByRole('alert')).toHaveText('El código es incorrecto, expiró o ya se usó.')
    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible()
    await expect(code).toHaveValue('')
    await expect(page).toHaveURL('/login')
  })

  test('refuses a wrong password without asking for a code', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill(user.email)
    await page.getByLabel('Contraseña', { exact: true }).fill(`${user.password}-wrong`)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()

    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.')
    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeHidden()
  })
})

test('signs up, verifies the email from the emailed link and only then signs in', async ({ page }) => {
  const details = newUserDetails('signup')
  const user: TestUser = { ...details, token: '' }

  await page.goto('/register')
  await page.getByLabel('Nombre completo').fill(details.fullName)
  await page.getByLabel('Correo electrónico').fill(details.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(details.password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()

  // The account can't sign in until the address is proved
  await submitSignIn(page, user)
  await expect(page.getByRole('heading', { name: 'Confirma tu correo' })).toBeVisible()

  await page.goto(await emailedLink(details.email, 'Confirma tu correo electrónico', '/verify-email'))

  await expect(page.getByRole('heading', { name: '¡Correo verificado!' })).toBeVisible()
  // The token is wiped from the address bar so it doesn't stay in the history
  expect(new URL(page.url()).hash).toBe('')
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
  await signIn(page, user)
})
