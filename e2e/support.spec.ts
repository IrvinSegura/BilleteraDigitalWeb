import type { Page } from '@playwright/test'

import { createUser, type TestUser } from './support/api'
import { promoteToSupport } from './support/db'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// The whole story of a support case, with two people at once: a user asks the bot, gets passed to the agent, and both
// talk until the case closes. Agents take any queued case, so this needs a database with no other agent.
test.describe.configure({ mode: 'serial' })

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAwAD/QH/qk1m6wAAAABJRU5ErkJggg==',
  'base64',
)

let userPage: Page
let agentPage: Page
let user: TestUser
let agent: TestUser

test.beforeAll(async ({ browser }) => {
  ;[user, agent] = await Promise.all([createUser('customer'), createUser('agent')])
  promoteToSupport(agent.email)
  userPage = await (await browser.newContext()).newPage()
  agentPage = await (await browser.newContext()).newPage()
  await waitOutRateLimits(userPage)
  await waitOutRateLimits(agentPage)
  await signIn(userPage, user)
  await signIn(agentPage, agent)
})

test.afterAll(async () => {
  await userPage.context().close()
  await agentPage.context().close()
})

async function write(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Mensaje' })
  await box.fill(text)
  await box.press('Enter')
  await expect(box).toHaveValue('')
}

test('the bot answers what it knows and asks if it helped', async () => {
  await userPage.getByRole('link', { name: 'Soporte' }).first().click()
  await expect(userPage.getByRole('heading', { level: 1, name: 'Soporte' })).toBeVisible()
  await expect(userPage.getByText(/soy el asistente de Billetera/)).toBeVisible()

  await write(userPage, '¿Cómo deposito dinero?')

  await expect(userPage.getByRole('log').getByText(/página segura de pago/)).toBeVisible()
  await expect(userPage.getByText('¿Te sirvió?')).toBeVisible()
})

test('what it does not know goes to a free agent, who is notified', async () => {
  await write(userPage, 'tengo un problema con mi perro y mi hermana')

  await expect(userPage.getByRole('status').filter({ hasText: 'te está atendiendo' })).toBeVisible()
  await expect(userPage.getByText('¿Te sirvió?')).toBeHidden()

  await agentPage.goto('/notifications')
  await agentPage.getByRole('button', { name: /Tienes un caso de soporte nuevo/ }).click()
  await expect(agentPage).toHaveURL(/\/support\/inbox\/[0-9a-f-]{36}$/)
})

test('the agent sees everything said to the bot', async () => {
  const thread = agentPage.getByRole('log')
  await expect(thread.getByText('¿Cómo deposito dinero?')).toBeVisible()
  await expect(thread.getByText(/página segura de pago/)).toBeVisible()
  await expect(thread.getByText('tengo un problema con mi perro y mi hermana')).toBeVisible()
  await expect(agentPage.getByRole('main').getByText(user.email)).toBeHidden()
})

test('they talk, each seeing what the other writes without reloading', async () => {
  await write(agentPage, 'Hola, ¿en qué te ayudo?')
  await expect(userPage.getByRole('log').getByText('Hola, ¿en qué te ayudo?')).toBeVisible({ timeout: 10_000 })

  await write(userPage, 'Tengo una duda')
  await expect(agentPage.getByRole('log').getByText('Tengo una duda')).toBeVisible({ timeout: 10_000 })
})

test('a picture sent by the user shows on both sides', async () => {
  await userPage.getByTestId('support-file').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: PNG })

  await expect(userPage.getByRole('img', { name: 'captura.png' })).toBeVisible()
  await expect(agentPage.getByRole('img', { name: 'captura.png' })).toBeVisible({ timeout: 10_000 })
})

test('a file of another type is refused before it travels', async () => {
  await userPage.getByTestId('support-file').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })

  await expect(userPage.getByRole('alert').filter({ hasText: 'Solo puedes enviar' })).toBeVisible()
})

test('the agent resolves the case and the user rates it', async () => {
  await agentPage.getByRole('button', { name: 'Resolver caso' }).click()
  await expect(agentPage.getByText('Este caso ya se cerró.')).toBeVisible()

  await expect(userPage.getByText('¿Cómo te atendimos?')).toBeVisible({ timeout: 10_000 })
  await userPage.getByRole('button', { name: '5 de 5' }).click()
  await userPage.getByLabel('Comentario (opcional)').fill('Muy amable')
  await userPage.getByRole('button', { name: 'Enviar calificación' }).click()

  await expect(userPage.getByText('¡Gracias por tu opinión!')).toBeVisible()
  await expect(userPage.getByRole('log').getByText('Tengo una duda')).toBeHidden()
})

test('the chat fits a phone', async () => {
  await userPage.setViewportSize({ width: 375, height: 700 })
  await write(userPage, 'hola')
  await expect(userPage.getByRole('log').getByText(/Cuéntame qué necesitas/).last()).toBeVisible()

  const overflow = await userPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
