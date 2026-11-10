import type { Page } from '@playwright/test'

import { createUser, deposit, type TestUser } from './support/api'
import { demoteLeftoverAgents, promoteToAdmin, promoteToSupport } from './support/db'
import { expect, test, waitOutRateLimits } from './support/fixtures'
import { signIn } from './support/ui'

// The whole story of a support case, with two people at once: a user asks the bot, gets passed to the agent, and both
// talk until the case closes. Agents take any queued case, so the agents of earlier runs go back to being customers
// first: the case must reach this run's agent. A problem with money goes one level up: the agent escalates the
// operation and an administrator, who signed in with a second factor, settles it.
test.describe.configure({ mode: 'serial' })

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAwAD/QH/qk1m6wAAAABJRU5ErkJggg==',
  'base64',
)

let userPage: Page
let agentPage: Page
let adminPage: Page
let user: TestUser
let agent: TestUser
let admin: TestUser

// Unique per run: a ticket from an earlier run that stopped halfway may still be open
const REPORT = `Prueba E2E ${Date.now()}: el cliente pide confirmar su depósito`
const RESOLUTION = 'Confirmamos el pago con el proveedor y el depósito está acreditado.'
const LESSON = `Prueba E2E ${Date.now()}: ¿cuánto tarda en verse un depósito?`

test.beforeAll(async ({ browser }) => {
  ;[user, agent, admin] = await Promise.all([createUser('customer'), createUser('agent'), createUser('admin', { twoFactor: true })])
  await deposit(user, 250)
  demoteLeftoverAgents()
  promoteToSupport(agent.email)
  promoteToAdmin(admin.email)
  userPage = await (await browser.newContext()).newPage()
  agentPage = await (await browser.newContext()).newPage()
  adminPage = await (await browser.newContext()).newPage()
  await waitOutRateLimits(userPage)
  await waitOutRateLimits(agentPage)
  await waitOutRateLimits(adminPage)
  await signIn(userPage, user)
  await signIn(agentPage, agent, '/support/inbox')
  await signIn(adminPage, admin, '/admin')
})

test.afterAll(async () => {
  await userPage.context().close()
  await agentPage.context().close()
  await adminPage.context().close()
})

// The case's details show one panel at a time; an open case starts on the customer's account
async function showTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).click()
}

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

test('the agent sees the customer\'s operations, read only, and escalates one', async () => {
  await showTab(agentPage, 'Operaciones')
  await expect(agentPage.getByText('Operaciones del cliente')).toBeVisible()
  await expect(agentPage.getByText('$250.00')).toBeVisible()

  await agentPage.getByRole('button', { name: /^Escalar Depósito/ }).click()
  const dialog = agentPage.getByRole('dialog')
  await dialog.getByLabel('Descripción').fill(REPORT)
  await dialog.getByRole('button', { name: 'Escalar' }).click()
  await expect(dialog).toBeHidden()

  await expect(agentPage.getByText('Escalados de este caso')).toBeVisible()
  await expect(agentPage.getByRole('button', { name: /^Escalar Depósito/ })).toBeHidden()
  await expect(userPage.getByRole('log').getByText(/pasó al equipo de administración/)).toBeVisible({ timeout: 10_000 })
})

test('the agent sees where the account stands and keeps an answer to send again', async () => {
  await showTab(agentPage, 'Cliente')
  const account = agentPage.locator('[data-slot="card"]').filter({ hasText: 'Cuenta del cliente' })
  await expect(account.getByText('No puede retirar hasta que su INE esté verificada.')).toBeVisible()

  await agentPage.getByRole('button', { name: 'Respuestas guardadas' }).click()
  const replies = agentPage.getByRole('dialog')
  await replies.getByLabel('Título').fill('Saludo')
  await replies.getByLabel('Texto').fill('Ya estoy revisando tu caso.')
  await replies.getByRole('button', { name: 'Guardar' }).click()
  await replies.getByRole('button', { name: 'Usar la respuesta Saludo' }).click()
  await expect(replies).toBeHidden()
  await expect(agentPage.getByRole('textbox', { name: 'Mensaje' })).toHaveValue('Ya estoy revisando tu caso.')
  await agentPage.getByRole('textbox', { name: 'Mensaje' }).clear()
})

test('the agent escalates a problem that is not about money', async () => {
  await showTab(agentPage, 'Operaciones')
  await agentPage.getByRole('button', { name: 'Escalar otro problema' }).click()
  const dialog = agentPage.getByRole('dialog')
  await dialog.getByLabel('Descripción').fill('Su cuenta sigue bloqueada')
  await dialog.getByRole('button', { name: 'Escalar' }).click()
  await expect(dialog).toBeHidden()
  await expect(agentPage.getByText('Acceso a la cuenta')).toBeVisible()
})

test('the agent leaves a note for the team and proposes an answer to the assistant', async () => {
  await showTab(agentPage, 'Historial')
  await expect(agentPage.getByText('Es su primer caso con una persona.')).toBeVisible()

  await showTab(agentPage, 'Notas')
  await agentPage.getByLabel('Nueva nota').fill('Escalé el depósito y el acceso')
  await agentPage.getByRole('button', { name: 'Agregar nota' }).click()
  await expect(agentPage.getByLabel('Nueva nota')).toHaveValue('')
  await expect(agentPage.getByText('Escalé el depósito y el acceso')).toBeVisible()
  // Only the team reads it
  await expect(userPage.getByRole('log').getByText('Escalé el depósito y el acceso')).toBeHidden()

  await agentPage.getByRole('button', { name: 'Enseñar al asistente' }).click()
  const dialog = agentPage.getByRole('dialog')
  await dialog.getByLabel('Pregunta del cliente').fill(LESSON)
  await dialog.getByLabel('Respuesta').fill('Con tarjeta se ve en unos minutos.')
  await dialog.getByRole('button', { name: 'Enviar sugerencia' }).click()
  await expect(dialog).toBeHidden()
})

test('an administrator reviews what the agent proposed', async () => {
  await adminPage.goto('/admin/support?view=bot')
  const suggestion = adminPage.getByRole('listitem').filter({ hasText: LESSON })
  await expect(suggestion.getByText('Con tarjeta se ve en unos minutos.')).toBeVisible()

  await suggestion.getByRole('button', { name: 'Ya la agregué' }).click()
  await expect(adminPage.getByText(LESSON)).toBeHidden()
})

test('an administrator credits the wallet from the ticket, from the home page', async () => {
  await adminPage.goto('/admin')
  await expect(adminPage.getByRole('link', { name: /Tickets abiertos/ })).toBeVisible()
  await adminPage.getByRole('link', { name: /Tickets abiertos/ }).click()
  await adminPage.getByRole('row').filter({ hasText: REPORT }).getByRole('link').click()

  await adminPage.getByRole('button', { name: 'Ajustar saldo' }).click()
  const dialog = adminPage.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Monto' }).fill('250')
  await dialog.getByRole('textbox', { name: 'Motivo' }).fill('Depósito que no llegó')
  await dialog.getByRole('button', { name: /^Abonar \$250\.00 MXN$/ }).click()
  await expect(dialog).toBeHidden()

  // Within the single administrator's limit, so it applies at once and shows on the ticket
  const recorded = adminPage.getByRole('region', { name: 'Ajustes de este ticket' })
  await expect(recorded.getByRole('link', { name: '+$250.00 MXN' })).toBeVisible()
  await expect(recorded.getByText('Aplicado')).toBeVisible()
})

test('an administrator settles it and the customer is told', async () => {
  await adminPage.getByRole('link', { name: 'Tickets' }).first().click()
  await expect(adminPage.getByRole('heading', { level: 1, name: 'Tickets de soporte' })).toBeVisible()
  await adminPage.getByRole('row').filter({ hasText: REPORT }).getByRole('link').click()
  await expect(adminPage.getByRole('link', { name: user.email })).toBeVisible()
  await expect(adminPage.getByText(REPORT)).toBeVisible()

  await adminPage.getByRole('button', { name: 'Marcar como resuelto' }).click()
  const dialog = adminPage.getByRole('dialog')
  await dialog.getByLabel('Resolución').fill(RESOLUTION)
  await dialog.getByRole('button', { name: 'Marcar como resuelto' }).click()
  await expect(dialog).toBeHidden()
  await expect(adminPage.getByText(RESOLUTION)).toBeVisible()

  await expect(userPage.getByRole('log').getByText(/Administración resolvió/)).toBeVisible({ timeout: 10_000 })
  await agentPage.reload()
  await showTab(agentPage, 'Operaciones')
  await expect(agentPage.getByText(`Resolución: ${RESOLUTION}`)).toBeVisible()
})

test('the agent who escalated it follows it in their own list, and is told when it is settled', async () => {
  // The account problem still waits; the deposit was settled
  await agentPage.getByRole('link', { name: /^Escalados\s*1$/ }).first().click()
  await expect(agentPage.getByRole('heading', { level: 1, name: 'Escalados' })).toBeVisible()
  await expect(agentPage.getByText('Su cuenta sigue bloqueada')).toBeVisible()

  await agentPage.getByRole('button', { name: 'Resueltos' }).click()
  const settled = agentPage.getByRole('listitem').filter({ hasText: REPORT })
  await expect(settled.getByText(RESOLUTION)).toBeVisible()
  await settled.getByRole('link', { name: /^Ver caso/ }).click()
  await expect(agentPage).toHaveURL(/\/support\/inbox\/[0-9a-f-]{36}$/)

  await agentPage.goto('/notifications')
  await expect(agentPage.getByText('Resolvieron un ticket que escalaste')).toBeVisible()
  await agentPage.goBack()
  await expect(agentPage.getByRole('log')).toBeVisible()
})

test('the agent resolves the case and the user rates it', async () => {
  await agentPage.getByRole('button', { name: 'Resolver caso' }).click()
  const dialog = agentPage.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'Escalado a administración' }).check()
  await dialog.getByRole('button', { name: 'Cerrar caso' }).click()
  await expect(agentPage.getByText('Este caso ya se cerró.')).toBeVisible()

  await expect(userPage.getByText('¿Cómo te atendimos?')).toBeVisible({ timeout: 10_000 })
  await userPage.getByRole('button', { name: '5 de 5' }).click()
  await userPage.getByLabel('Comentario (opcional)').fill('Muy amable')
  await userPage.getByRole('button', { name: 'Enviar calificación' }).click()

  await expect(userPage.getByText('¡Gracias por tu opinión!')).toBeVisible()
  await expect(userPage.getByRole('log').getByText('Tengo una duda')).toBeHidden()
})

test('the customer reports a problem from a movement, and the agent can give the case back', async () => {
  await userPage.goto('/wallets')
  await userPage.getByRole('link', { name: /MXN/ }).first().click()
  await userPage.getByRole('button', { name: /Depósito/ }).first().click()
  await userPage.getByRole('link', { name: 'Reportar un problema' }).click()

  await expect(userPage).toHaveURL(/\/support\?wallet=.+&movement=.+/)
  await userPage.getByLabel('¿Qué pasó?').fill('El depósito aparece dos veces')
  await userPage.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(userPage).toHaveURL('/support')

  // It skips the bot: the free agent gets it with the movement named
  await expect(userPage.getByRole('log').getByText(/Reporto un problema con un movimiento: Depósito/)).toBeVisible()
  await agentPage.getByRole('link', { name: 'Abrir mi caso activo' }).click({ timeout: 15_000 })
  await expect(agentPage.getByRole('log').getByText(/El depósito aparece dos veces/)).toBeVisible()

  await agentPage.getByRole('button', { name: 'Devolver a la fila' }).click()
  await agentPage.getByRole('dialog').getByRole('button', { name: 'Devolver a la fila' }).click()
  await expect(agentPage).toHaveURL('/support/inbox')
  await expect(userPage.getByRole('log').getByText('La conversación volvió a la fila para que otra persona la atienda.')).toBeVisible({ timeout: 10_000 })
})

test('the chat fits a phone', async () => {
  await userPage.setViewportSize({ width: 375, height: 700 })
  await write(userPage, 'hola')
  await expect(userPage.getByRole('log').getByText(/Cuéntame qué necesitas/).last()).toBeVisible()

  const overflow = await userPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
