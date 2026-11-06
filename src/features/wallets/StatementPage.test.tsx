import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { auth } from '@/test/auth'
import { mxnWallet } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
const pdf = vi.hoisted(() => ({ build: vi.fn(), save: vi.fn() }))
vi.mock('@/features/statements/statement-pdf', () => ({ buildStatementPdf: pdf.build, statementFileName: () => 'statement.pdf' }))
vi.mock('@/lib/download', () => ({ saveFile: pdf.save }))

const { StatementPage } = await import('./StatementPage')

const money = (amount: string) => ({ amount, currency: 'MXN' })
const movement = (id: string, type: string, direction: string, fields = {}) => ({
  transactionId: id, type, direction, operationId: `op-${id}`, amount: money('100.00'), balanceAfter: money('900.00'),
  createdAt: '2026-11-04T15:00:00Z', ...fields,
})

async function rowOf(id: string) {
  const folio = await screen.findByText(`op-${id}`.slice(0, 8))
  return within(folio.closest('tr')!)
}

describe('StatementPage concept column', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    api.on('GET', '/api/v1/wallets/{walletId}', mxnWallet)
    api.on('GET', '/api/v1/wallets/{walletId}/summary', {
      month: '2026-11', openingBalance: money('1000.00'), moneyIn: money('100.00'), moneyOut: money('100.00'), closingBalance: money('1000.00'),
    })
    api.on('GET', '/api/v1/wallets/{walletId}/movements', {
      items: [
        movement('t-1', 'TRANSFER', 'OUT', { counterpartyName: 'Beto López', description: 'Cena del viernes' }),
        movement('t-2', 'TRANSFER', 'IN', { counterpartyName: 'Carla Ruiz' }),
        movement('t-3', 'DEPOSIT', 'IN'),
      ],
      page: 0, size: 100, hasNext: false,
    })
    renderWithProviders(<StatementPage />, { route: '/wallets/wallet-mxn/statement?month=2026-11', path: '/wallets/:walletId/statement' })
  })

  it('says who a transfer was with and why, under what kind it was', async () => {
    const row = await rowOf('t-1')

    expect(row.getByText('Transferencia enviada')).toBeInTheDocument()
    expect(row.getByText('Beto López · Cena del viernes')).toBeInTheDocument()
  })

  it('shows only the person when the sender wrote no concept', async () => {
    const row = await rowOf('t-2')

    expect(row.getByText('Carla Ruiz')).toBeInTheDocument()
  })

  it('shows only the kind when nobody else took part', async () => {
    const row = await rowOf('t-3')

    expect(row.getByRole('cell', { name: 'Depósito' })).toBeInTheDocument()
  })
})

describe('StatementPage PDF download', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    pdf.build.mockReset().mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }))
    pdf.save.mockReset()
    api.on('GET', '/api/v1/wallets/{walletId}', mxnWallet)
    api.on('GET', '/api/v1/wallets/{walletId}/summary', {
      month: '2026-11', openingBalance: money('1000.00'), moneyIn: money('100.00'), moneyOut: money('0.00'), closingBalance: money('1100.00'),
    })
    api.on('GET', '/api/v1/wallets/{walletId}/movements', { items: [movement('t-1', 'DEPOSIT', 'IN')], page: 0, size: 100, hasNext: false })
  })

  it('builds the PDF from what the page already shows, without reading it again', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StatementPage />, { route: '/wallets/wallet-mxn/statement?month=2026-11', path: '/wallets/:walletId/statement' })
    await rowOf('t-1')
    const reads = api.calls.length

    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }))

    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith(expect.any(Blob), 'statement.pdf'))
    expect(pdf.build.mock.calls[0]![0]).toMatchObject({
      general: false,
      month: '2026-11',
      holder: { fullName: 'Ana López' },
      wallets: [{ walletId: 'wallet-mxn', currency: 'MXN', closingBalance: money('1100.00'), cut: false, movements: [{ transactionId: 't-1' }] }],
    })
    expect(api.calls).toHaveLength(reads)
  })
})
