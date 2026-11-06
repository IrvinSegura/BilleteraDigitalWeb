import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { mxnWallet } from '@/test/fixtures'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
// The chart library draws nothing useful in a simulated browser
vi.mock('./BalanceHistoryCard', () => ({ BalanceHistoryCard: () => null }))
vi.mock('./BalanceCard', () => ({ BalanceCard: () => null }))

const { WalletDetailPage } = await import('./WalletDetailPage')
const { filtersFrom } = await import('./MovementFilterBar')

const MOVEMENTS = '/api/v1/wallets/{walletId}/movements'

function open(search = '') {
  return renderWithProviders(<WalletDetailPage />, { route: `/wallets/wallet-mxn${search}`, path: '/wallets/:walletId' })
}

describe('WalletDetailPage filters', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', '/api/v1/wallets/{walletId}', mxnWallet)
    api.on('GET', MOVEMENTS, { items: [], page: 0, size: 20, hasNext: true })
  })

  it('finds the list as it was left when coming back to the address', async () => {
    open('?direction=OUT&q=cena&page=2')

    await waitFor(() => expect(api.callsTo('GET', MOVEMENTS).length).toBeGreaterThan(0))
    const { query } = api.callsTo('GET', MOVEMENTS)[0]!
    expect(query.get('direction')).toBe('OUT')
    expect(query.get('q')).toBe('cena')
    expect(query.get('page')).toBe('2')
    expect(await screen.findByRole('combobox', { name: 'Buscar' })).toHaveValue('cena')
  })

  it('keeps the filters and the page in the address, and a new filter starts over', async () => {
    open('?q=cena')

    await userEvent.click(await screen.findByRole('button', { name: /siguiente/i }))
    await waitFor(() => expect(currentLocation()).toContain('page=1'))
    expect(currentLocation()).toContain('q=cena')

    await userEvent.click(screen.getByRole('button', { name: 'Salidas' }))
    await waitFor(() => expect(currentLocation()).toContain('direction=OUT'))
    expect(currentLocation()).not.toContain('page=')
  })

  it('ignores what does not belong in the filters', () => {
    expect(filtersFrom(new URLSearchParams('from=ayer&to=2026-11-05&direction=SIDEWAYS&type=NOPE&type=DEPOSIT&q=%20%20')))
      .toEqual({ to: '2026-11-05', type: ['DEPOSIT'] })
  })
})
