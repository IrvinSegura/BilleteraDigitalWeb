import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

stubApi()

const { MovementRow } = await import('./MovementList')
type Movement = Parameters<typeof MovementRow>[0]['movement']

const movement = (fields: Partial<Movement>): Movement => ({
  transactionId: 't-1', type: 'TRANSFER', direction: 'OUT', operationId: 'op-1',
  amount: { amount: '120.00', currency: 'MXN' }, balanceAfter: { amount: '880.00', currency: 'MXN' },
  createdAt: new Date().toISOString(), ...fields,
})

const row = (fields: Partial<Movement>) => {
  renderWithProviders(<MovementRow movement={movement(fields)} onOpen={vi.fn()} />)
  return screen.getByRole('button')
}

describe('MovementRow', () => {
  it('titles a transfer with the other person and says what kind it was and why', () => {
    const button = row({ counterpartyName: 'Beto López', description: 'Cena del viernes' })

    expect(button.querySelector('.font-medium')).toHaveTextContent('Beto López')
    expect(button).toHaveTextContent('Transferencia enviada')
    expect(button).toHaveTextContent('Cena del viernes')
  })

  it('leaves out the concept when the sender wrote none', () => {
    const button = row({ counterpartyName: 'Beto López' })

    expect(button).toHaveTextContent('Transferencia enviada ·')
    expect(button).not.toHaveTextContent('· ·')
  })

  it('still reads by its kind when nobody else took part', () => {
    const button = row({ type: 'DEPOSIT', direction: 'IN' })

    expect(button.querySelector('.font-medium')).toHaveTextContent('Depósito')
    expect(button.querySelector('.text-xs')).not.toHaveTextContent('·')
  })

  it('keeps the concept of a transfer whose other person is gone', () => {
    const button = row({ description: 'Renta' })

    expect(button.querySelector('.font-medium')).toHaveTextContent('Transferencia enviada')
    expect(button).toHaveTextContent('Renta')
  })
})
