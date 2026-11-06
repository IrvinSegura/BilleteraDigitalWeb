import { screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()

const { DepositReturnPage } = await import('./DepositReturnPage')
const { rememberPendingDeposit } = await import('./pending-deposits')

const deposit = (status: string) => ({ id: 'd-1', status, amount: { amount: '500.00', currency: 'MXN' }, balance: { amount: '500.00', currency: 'MXN' } })

function open() {
  return renderWithProviders(<DepositReturnPage />, { route: '/deposits/return?payment=d-1&result=success' })
}

describe('DepositReturnPage', () => {
  beforeEach(() => {
    api.reset()
    rememberPendingDeposit('d-1', 'wallet-mxn')
  })

  it('keeps showing the result when it renders again after the deposit settled', async () => {
    api.on('GET', '/api/v1/wallets/{walletId}/deposits/{depositId}', deposit('COMPLETED'))
    open()
    expect(await screen.findByText('Depósito recibido')).toBeInTheDocument()

    // Renders the same page again, once the deposit was forgotten
    await act(() => i18n.changeLanguage('en'))

    try {
      expect(screen.getByText('Deposit received')).toBeInTheDocument()
    } finally {
      await act(() => i18n.changeLanguage('es'))
    }
  })

  it('stops waiting after a while and says the payment is still in progress', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      api.on('GET', '/api/v1/wallets/{walletId}/deposits/{depositId}', deposit('PENDING'))
      open()
      expect(await screen.findByText('Confirmando tu pago…')).toBeInTheDocument()

      await act(() => vi.advanceTimersByTimeAsync(125_000))

      expect(screen.getByText('Tu pago sigue en proceso')).toBeInTheDocument()
      const polls = api.callsTo('GET', '/api/v1/wallets/{walletId}/deposits/{depositId}').length
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/deposits/{depositId}')).toHaveLength(polls)
    } finally {
      vi.useRealTimers()
    }
  })
})
