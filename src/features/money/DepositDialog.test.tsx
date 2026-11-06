import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { mxnWallet, usdWallet } from '@/test/fixtures'
import { renderDialog } from '@/test/render'

const api = stubApi()

const { DepositDialog } = await import('./DepositDialog')
const { pendingDepositWallet } = await import('./pending-deposits')

const deposit = (overrides: Record<string, unknown> = {}) => ({
  id: 'dep-1', status: 'COMPLETED', amount: { amount: '500.00', currency: 'MXN' },
  balance: { amount: '1500.00', currency: 'MXN' }, createdAt: '2026-11-04T18:00:00Z', ...overrides,
})

function open(walletId?: string) {
  renderDialog(<DepositDialog walletId={walletId} onClose={vi.fn()} />, { cached: [[['wallets'], [mxnWallet, usdWallet]]] })
}

async function depositAmount(amount: string) {
  await userEvent.type(screen.getByLabelText('Monto'), amount)
  await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }))
}

describe('DepositDialog', () => {
  const assign = vi.fn()

  beforeEach(() => {
    api.reset()
    assign.mockReset()
    vi.stubGlobal('location', { ...window.location, assign })
    api.on('GET', '/api/v1/wallets', [mxnWallet, usdWallet])
    api.on('POST', '/api/v1/wallets/{walletId}/deposits', deposit())
  })

  it('credits a completed deposit and shows the new balance', async () => {
    open()
    await depositAmount('500')
    expect(await screen.findByText('Depositaste')).toBeInTheDocument()
    expect(screen.getByText('$1,500.00')).toBeInTheDocument()
    const [post] = api.callsTo('POST', '/api/v1/wallets/{walletId}/deposits')
    expect(post!.body).toEqual({ amount: 500 })
    expect(post!.headers.get('Idempotency-Key')).toBeTruthy()
  })

  it('reuses the same idempotency key when the deposit is sent again', async () => {
    api.on('POST', '/api/v1/wallets/{walletId}/deposits', problem(503, 'PROVIDER_UNAVAILABLE'))
    open()
    await depositAmount('500')
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar al pago' }))
    await vi.waitFor(() => expect(api.callsTo('POST', '/api/v1/wallets/{walletId}/deposits')).toHaveLength(2))
    const [first, second] = api.callsTo('POST', '/api/v1/wallets/{walletId}/deposits')
    expect(second!.headers.get('Idempotency-Key')).toBe(first!.headers.get('Idempotency-Key'))
  })

  it('goes to a trusted checkout and remembers the wallet for the way back', async () => {
    api.on('POST', '/api/v1/wallets/{walletId}/deposits',
      deposit({ status: 'PENDING', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' }))
    open()
    await depositAmount('500')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1'))
    expect(pendingDepositWallet('dep-1')).toBe('wallet-mxn')
  })

  it('never follows a checkout on an unknown host', async () => {
    api.on('POST', '/api/v1/wallets/{walletId}/deposits',
      deposit({ status: 'PENDING', checkoutUrl: 'https://checkout.stripe.com.evil.example/pay' }))
    open()
    await depositAmount('500')
    expect(await screen.findByText(/No pudimos abrir la página de pago de forma segura/)).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('warns above the maximum per deposit of the currency', async () => {
    open('wallet-usd')
    await userEvent.type(screen.getByLabelText('Monto'), '5001')
    expect(screen.getByText('Máximo $5,000.00 por depósito.')).toHaveClass('text-destructive')
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeDisabled()
  })

  it('fills the amount from the quick amounts', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: '$1,000' }))
    expect(screen.getByLabelText('Monto')).toHaveValue('1000')
    expect(screen.getByText('Recibirás')).toBeInTheDocument()
  })

  it('explains a rejected deposit', async () => {
    api.on('POST', '/api/v1/wallets/{walletId}/deposits', deposit({ status: 'REJECTED', rejectionReason: undefined }))
    open()
    await depositAmount('500')
    expect(await screen.findByText('No se pudo depositar')).toBeInTheDocument()
    expect(screen.getByText(/No se hizo ningún cargo/)).toBeInTheDocument()
  })
})
