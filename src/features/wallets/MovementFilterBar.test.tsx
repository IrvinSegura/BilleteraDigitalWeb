import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MovementFilters } from '@/api/queries'
import { stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()

const { MovementFilterBar } = await import('./MovementFilterBar')

const FOLIO = '7f3c1b52-0d4e-4a8b-9c11-2e6f5a7d8b90'
const onChange = vi.fn()

function Bar() {
  const [filters, setFilters] = useState<MovementFilters>({})
  return <MovementFilterBar walletId="w-1" filters={filters} onChange={(next) => { onChange(next); setFilters(next) }} />
}

async function openSearch() {
  const user = userEvent.setup()
  renderWithProviders(<Bar />)
  await user.click(screen.getByRole('button', { name: /Filtrar/ }))
  return { user, field: screen.getByRole('combobox', { name: 'Buscar' }) }
}

describe('MovementFilterBar search', () => {
  beforeEach(() => {
    api.reset()
    onChange.mockClear()
    api.on('GET', '/api/v1/wallets/{walletId}/movements', {
      items: [{
        transactionId: 't-1', type: 'TRANSFER', direction: 'OUT', operationId: FOLIO,
        amount: { amount: '120.00', currency: 'MXN' }, balanceAfter: { amount: '880.00', currency: 'MXN' },
        createdAt: '2026-11-04T15:00:00Z', counterpartyName: 'Beto López', description: 'Cena del viernes',
      }],
      page: 0, size: 6, hasNext: false,
    })
  })

  it('searches by what people remember: names, with their accents and spaces', async () => {
    const { user, field } = await openSearch()

    await user.type(field, 'Beto Ló')

    expect(field).toHaveValue('Beto Ló')
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: 'Beto Ló' }))
  })

  it('previews the movements found under the person, and picking one filters by its folio', async () => {
    const { user, field } = await openSearch()

    await user.type(field, 'cena')

    const option = await screen.findByRole('option', { name: /Beto López/ })
    expect(option).toHaveTextContent('Cena del viernes')
    expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/movements').at(-1)!.query.get('q')).toBe('cena')

    await user.click(option)

    expect(field).toHaveValue(FOLIO)
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: FOLIO }))
  })

  it('has nothing to suggest for a whole folio', async () => {
    const { user, field } = await openSearch()

    await user.click(field)
    await user.paste(FOLIO)

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ q: FOLIO }))
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/movements')).toHaveLength(0)
  })

  it('stops at the length the API accepts', async () => {
    const { field } = await openSearch()

    expect(field).toHaveAttribute('maxlength', '60')
  })
})
