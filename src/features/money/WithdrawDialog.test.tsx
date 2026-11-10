import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { bankAccount, limits, mxnWallet, usdWallet } from '@/test/fixtures'
import { currentLocation, renderDialog } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { WithdrawDialog } = await import('./WithdrawDialog')

const withdrawal = (status: 'PENDING' | 'PAID' | 'FAILED') => ({
  id: 'wd-1', status, amount: { amount: '300.00', currency: 'MXN' }, balance: { amount: '700.00', currency: 'MXN' },
  bankAccountId: 'bank-1', createdAt: '2026-11-04T18:00:00Z',
})

function open(walletId?: string, wallets = [mxnWallet]) {
  const onClose = vi.fn()
  renderDialog(<WithdrawDialog walletId={walletId} onClose={onClose} />, { cached: [[['wallets'], wallets]] })
  return onClose
}

async function reachReview(amount = '300') {
  await userEvent.type(screen.getByLabelText('Monto'), amount)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(await screen.findByText('Confirma el retiro')).toBeInTheDocument()
}

describe('WithdrawDialog', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    api.on('GET', '/api/v1/wallets', [mxnWallet])
    api.on('GET', '/api/v1/wallets/{walletId}/limits', limits())
    api.on('GET', '/api/v1/bank-accounts', [bankAccount()])
    api.on('POST', '/api/v1/wallets/{walletId}/withdrawals', withdrawal('PENDING'))
  })

  it('asks for a verified email first', () => {
    auth.reset(testUser({ emailVerified: false }))
    open()
    expect(screen.getByText('Verifica tu correo primero')).toBeInTheDocument()
  })

  it('says the INE must be verified first and leads to it, without hiding the form', async () => {
    api.on('GET', '/api/v1/users/me/identity-verification', { status: 'NOT_STARTED', attemptsLeft: 3 })
    const onClose = open()
    const link = await screen.findByRole('link', { name: 'Verificar ahora' })
    expect(screen.getByText(/primero verifica tu identidad/)).toBeInTheDocument()
    expect(screen.getByLabelText('Monto')).toBeInTheDocument()
    await userEvent.click(link)
    expect(currentLocation()).toBe('/settings/identity')
    expect(onClose).toHaveBeenCalled()
  })

  it('only says the INE is under review while it is', async () => {
    api.on('GET', '/api/v1/users/me/identity-verification', { status: 'PENDING_REVIEW', attemptsLeft: 2 })
    open()
    expect(await screen.findByText(/está en revisión/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Verificar ahora' })).not.toBeInTheDocument()
  })

  it('always asks for the password up front and sends it with the CLABE chosen', async () => {
    open()
    expect(await screen.findByText(/BBVA.*4321|•• 4321/)).toBeInTheDocument()
    await reachReview()

    const confirm = screen.getByRole('button', { name: 'Confirmar retiro' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta#2026')
    await userEvent.click(confirm)

    expect(await screen.findByText('Retiro en camino')).toBeInTheDocument()
    const [post] = api.callsTo('POST', '/api/v1/wallets/{walletId}/withdrawals')
    expect(post!.path).toBe('/api/v1/wallets/wallet-mxn/withdrawals')
    expect(post!.body).toEqual({ amount: 300, bankAccountId: 'bank-1', currentPassword: 'Secreta#2026' })
    expect(post!.headers.get('Idempotency-Key')).toBeTruthy()
  })

  it('says it is working while it withdraws, and warns when no answer came', async () => {
    let fail!: (reason: unknown) => void
    api.on('POST', '/api/v1/wallets/{walletId}/withdrawals', () => new Promise((_resolve, reject) => { fail = reject }))
    open()
    expect(await screen.findByText(/BBVA.*4321|•• 4321/)).toBeInTheDocument()
    await reachReview()
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta#2026')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))

    expect(await screen.findByRole('button', { name: 'Procesando...' })).toBeDisabled()
    fail(new TypeError('Failed to fetch'))

    expect(await screen.findByText(/no sabemos si se completó/)).toBeInTheDocument()
  })

  it('asks for the authenticator code when two-factor is on', async () => {
    auth.reset(testUser({ twoFactorEnabled: true }))
    api.on('POST', '/api/v1/wallets/{walletId}/withdrawals', withdrawal('PAID'))
    open()
    await screen.findByText(/•• 4321/)
    await reachReview()
    await userEvent.type(screen.getByLabelText('Código de verificación'), '654321')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))

    expect(await screen.findByText('Retiro enviado a tu banco')).toBeInTheDocument()
    expect(api.callsTo('POST', '/api/v1/wallets/{walletId}/withdrawals')[0]!.body).toMatchObject({ twoFactorCode: '654321' })
  })

  it('says the money came back when the withdrawal failed', async () => {
    api.on('POST', '/api/v1/wallets/{walletId}/withdrawals', withdrawal('FAILED'))
    open()
    await screen.findByText(/•• 4321/)
    await reachReview()
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))
    expect(await screen.findByText('Devolvimos el dinero a tu billetera.')).toBeInTheDocument()
  })

  it('sends someone without a CLABE to add one', async () => {
    api.on('GET', '/api/v1/bank-accounts', [])
    const onClose = open()
    const link = await screen.findByRole('link', { name: 'Agregar cuenta bancaria' })
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await userEvent.click(link)
    expect(currentLocation()).toBe('/bank-accounts')
    expect(onClose).toHaveBeenCalled()
  })

  it('holds an account still in its cooling-off period', async () => {
    api.on('GET', '/api/v1/bank-accounts', [bankAccount({ withdrawalsAvailableFrom: '2099-01-01T00:00:00Z' })])
    open()
    expect(await screen.findByText(/esta cuenta recibe retiros a partir del/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Monto'), '100')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('withdraws everything with one tap and refuses more than the balance', async () => {
    open()
    await screen.findByText(/•• 4321/)
    await userEvent.click(screen.getByRole('button', { name: 'Retirar todo' }))
    expect(screen.getByLabelText('Monto')).toHaveValue('1000.00')

    await userEvent.type(screen.getByLabelText('Monto'), '0')
    await userEvent.clear(screen.getByLabelText('Monto'))
    await userEvent.type(screen.getByLabelText('Monto'), '1000.01')
    expect(screen.getByText('Supera tu saldo: $1,000.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })

  it('needs no bank account for a dollar wallet', async () => {
    api.on('GET', '/api/v1/wallets', [mxnWallet, usdWallet])
    api.on('GET', '/api/v1/bank-accounts', [])
    open('wallet-usd', [mxnWallet, usdWallet])
    await userEvent.type(screen.getByLabelText('Monto'), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Transferencia')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))
    await screen.findByText('Retiro en camino')
    expect(api.callsTo('POST', '/api/v1/wallets/{walletId}/withdrawals')[0]!.body).not.toHaveProperty('bankAccountId')
  })

  it('offers only the wallets whose currency can be withdrawn', async () => {
    api.on('GET', '/api/v1/withdrawals/currencies', { currencies: ['MXN'] })
    open('wallet-usd', [mxnWallet, usdWallet])
    // The dollar wallet asked for is passed over for the one in pesos, which goes to a CLABE
    expect(await screen.findByText(/•• 4321/)).toBeInTheDocument()
    expect(screen.queryByText('Desde')).not.toBeInTheDocument()
  })

  it('says withdrawals are in pesos when no wallet can withdraw', async () => {
    api.on('GET', '/api/v1/withdrawals/currencies', { currencies: ['MXN'] })
    open('wallet-usd', [usdWallet])
    expect(await screen.findByText(/solo puedes retirar pesos/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
  })

  it('shows the API refusal on the review', async () => {
    api.on('POST', '/api/v1/wallets/{walletId}/withdrawals', problem(422, 'INSUFFICIENT_FUNDS'))
    open()
    await screen.findByText(/•• 4321/)
    await reachReview()
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))
    expect(await screen.findByText('No tienes saldo suficiente.')).toBeInTheDocument()
  })
})
