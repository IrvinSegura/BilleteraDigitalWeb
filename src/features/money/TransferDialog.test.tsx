import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { limits, mxnWallet } from '@/test/fixtures'
import { renderDialog } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { TransferDialog } = await import('./TransferDialog')

const sent = {
  id: '7f0c2a9e-0000-4000-8000-000000000001', recipientEmail: 'beto@example.com', recipientName: 'Beto Ruiz',
  amount: { amount: '250.00', currency: 'MXN' }, description: 'Cena', createdAt: '2026-11-04T18:00:00Z',
}

function open(props: Partial<Parameters<typeof TransferDialog>[0]> = {}) {
  return renderDialog(<TransferDialog onClose={vi.fn()} {...props} />, { cached: [[['wallets'], [mxnWallet]]] })
}

async function fillForm(email = 'beto@example.com', amount = '250') {
  await userEvent.type(screen.getByLabelText('Correo de quien recibe'), email)
  await userEvent.type(screen.getByLabelText('Monto'), amount)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

describe('TransferDialog', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    api.on('GET', '/api/v1/wallets', [mxnWallet])
    api.on('GET', '/api/v1/wallets/{walletId}/limits', limits())
    api.on('GET', '/api/v1/transfers/recipients', [])
    api.on('GET', '/api/v1/transfers/recipient', { email: 'beto@example.com', displayName: 'Beto Ruiz' })
    api.on('POST', '/api/v1/transfers', sent)
  })

  it('asks for a verified email before anything else', () => {
    auth.reset(testUser({ emailVerified: false }))
    open()
    expect(screen.getByText('Verifica tu correo primero')).toBeInTheDocument()
    expect(screen.queryByLabelText('Correo de quien recibe')).not.toBeInTheDocument()
  })

  it('names who the email belongs to on the review, then sends once with an idempotency key', async () => {
    open()
    await fillForm()

    expect(await screen.findByText('Confirma el envío')).toBeInTheDocument()
    expect(screen.getByText('Beto Ruiz')).toBeInTheDocument()
    expect(screen.getByText('$750.00')).toBeInTheDocument()
    expect(api.callsTo('GET', '/api/v1/transfers/recipient')[0]!.query.get('currency')).toBe('MXN')

    await userEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    expect(await screen.findByText('Enviaste a Beto Ruiz')).toBeInTheDocument()
    const [post] = api.callsTo('POST', '/api/v1/transfers')
    expect(post!.body).toEqual({ sourceWalletId: 'wallet-mxn', recipientEmail: 'beto@example.com', amount: 250 })
    expect(post!.headers.get('Idempotency-Key')).toMatch(/.{16,}/)
  })

  it('shows the fee before sending and says it is working while it does', async () => {
    let answer!: (reply: unknown) => void
    api.on('POST', '/api/v1/transfers', () => new Promise((resolve) => { answer = resolve }))
    open()
    await fillForm()

    expect(await screen.findByText('Comisión')).toBeInTheDocument()
    expect(screen.getByText('Sin comisión')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))

    expect(await screen.findByRole('button', { name: 'Procesando...' })).toBeDisabled()
    answer(sent)
    expect(await screen.findByText('Enviaste a Beto Ruiz')).toBeInTheDocument()
  })

  it('says the outcome is unknown when no answer came, and retries without sending it twice', async () => {
    api.on('POST', '/api/v1/transfers', () => Promise.reject(new TypeError('Failed to fetch')))
    open()
    await fillForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar ahora' }))

    expect(await screen.findByText(/no sabemos si se completó/)).toBeInTheDocument()
    api.on('POST', '/api/v1/transfers', sent)
    await userEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))

    expect(await screen.findByText('Enviaste a Beto Ruiz')).toBeInTheDocument()
    const [first, second] = api.callsTo('POST', '/api/v1/transfers')
    expect(second!.headers.get('Idempotency-Key')).toBe(first!.headers.get('Idempotency-Key'))
  })

  it('refuses sending to yourself and amounts over the balance without calling the API', async () => {
    open()
    await userEvent.type(screen.getByLabelText('Correo de quien recibe'), 'ANA@example.com')
    await userEvent.type(screen.getByLabelText('Monto'), '50')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('No puedes enviarte dinero a ti mismo')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Monto'))
    await userEvent.type(screen.getByLabelText('Monto'), '1500')
    expect(screen.getByText('Supera tu saldo disponible: $1,000.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    expect(api.callsTo('GET', '/api/v1/transfers/recipient')).toHaveLength(0)
  })

  it('blocks amounts over what the daily limit still allows', async () => {
    api.on('GET', '/api/v1/wallets/{walletId}/limits', limits('100.00'))
    open()
    await userEvent.type(screen.getByLabelText('Monto'), '150')
    expect(await screen.findByText(/Supera lo que puedes enviar hoy: \$100\.00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('says when the email has no wallet in that currency', async () => {
    api.on('GET', '/api/v1/transfers/recipient', problem(404, 'RECIPIENT_NOT_FOUND', 'No user with a MXN wallet'))
    open()
    await fillForm('nadie@example.com')
    expect(await screen.findByText('No encontramos una billetera en MXN con ese correo')).toBeInTheDocument()
    expect(screen.queryByText('Confirma el envío')).not.toBeInTheDocument()
  })

  it('asks for the two-factor code when the API wants it and retries with the same key', async () => {
    auth.reset(testUser({ twoFactorEnabled: true }))
    let attempts = 0
    api.on('POST', '/api/v1/transfers', () => (++attempts === 1 ? problem(403, 'TWO_FACTOR_REQUIRED') : sent))
    open()
    await fillForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar ahora' }))

    expect(await screen.findByText('Confirma que eres tú')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirmar y enviar' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Código de verificación'), '123456')
    await userEvent.click(confirm)

    expect(await screen.findByText('Enviaste a Beto Ruiz')).toBeInTheDocument()
    const [first, second] = api.callsTo('POST', '/api/v1/transfers')
    expect(second!.body).toMatchObject({ twoFactorCode: '123456' })
    expect(second!.headers.get('Idempotency-Key')).toBe(first!.headers.get('Idempotency-Key'))
  })

  it('clears a wrong code and says why', async () => {
    let attempts = 0
    api.on('POST', '/api/v1/transfers', () =>
      problem(403, ++attempts === 1 ? 'PASSWORD_CONFIRMATION_REQUIRED' : 'INCORRECT_PASSWORD'))
    open()
    await fillForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar ahora' }))
    const password = await screen.findByLabelText('Contraseña')
    await userEvent.type(password, 'mala')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar' }))

    expect(await screen.findByText('La contraseña es incorrecta.')).toBeInTheDocument()
    await waitFor(() => expect(password).toHaveValue(''))
  })

  it('fills in a payment link and pays from the wallet in its currency', async () => {
    open({ prefill: { to: 'beto@example.com', amount: '99.50', currency: 'MXN', concept: 'Boletos' } })
    expect(screen.getByText('Pagar un cobro')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo de quien recibe')).toHaveValue('beto@example.com')
    expect(screen.getByLabelText('Monto')).toHaveValue('99.50')
    expect(screen.getByLabelText('Concepto (opcional)')).toHaveValue('Boletos')
  })

  it('works out the wallet when they load after the dialog opened', async () => {
    renderDialog(<TransferDialog onClose={vi.fn()} prefill={{ to: 'beto@example.com', amount: '99.50', currency: 'MXN' }} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled())
  })

  it('refuses to pay a request from a wallet in another currency', async () => {
    open({ prefill: { to: 'beto@example.com', amount: '20', currency: 'USD' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Este cobro es en USD')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    expect(api.callsTo('GET', '/api/v1/transfers/recipient')).toHaveLength(0)
  })

  it('offers recent recipients one tap away', async () => {
    api.on('GET', '/api/v1/transfers/recipients', [{ email: 'carla@example.com', displayName: 'Carla Pérez' }])
    open()
    await userEvent.click(await screen.findByRole('button', { name: /Carla Pérez/ }))
    expect(screen.getByLabelText('Correo de quien recibe')).toHaveValue('carla@example.com')
  })
})
