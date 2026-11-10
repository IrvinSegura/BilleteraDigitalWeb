// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { WalletStatement } from './statement-data'
import { buildStatementPdf, pdfText, statementFileName, statementFolio } from './statement-pdf'

const money = (amount: string, currency = 'MXN') => ({ amount, currency })
const statement = (walletId: string, currency: string, movements = 0): WalletStatement => ({
  walletId,
  currency,
  openingBalance: money('1000.00', currency),
  moneyIn: money('500.00', currency),
  moneyOut: money('200.00', currency),
  closingBalance: money('1300.00', currency),
  movements: Array.from({ length: movements }, (_, i) => ({
    transactionId: `t-${i}`, operationId: `op-${i}`, type: 'TRANSFER', direction: i % 2 ? 'IN' : 'OUT',
    amount: money('10.00', currency), balanceAfter: money('990.00', currency), createdAt: '2026-10-05T15:00:00Z',
    counterpartyName: 'Beto López', description: i % 3 ? undefined : 'Cena',
  })),
  cut: false,
})
const holder = { fullName: 'Ana López', email: 'ana@example.com' }
const october = { from: '2026-10-01', to: '2026-10-31' }
const quarter = { from: '2026-09-01', to: '2026-11-06' }

describe('pdfText', () => {
  it('turns the spaces and minus sign Intl writes into ones the PDF fonts have', () => {
    expect(pdfText('1 000 € − 5')).toBe('1 000 € - 5')
  })

  it('keeps accents and the typographic marks of Windows-1252, and replaces what the fonts lack', () => {
    expect(pdfText('Peña “Ñandú” — 5 ₿ 😀')).toBe('Peña “Ñandú” — 5 ? ?')
  })

  it('keeps line breaks, which separate a movement from its detail', () => {
    expect(pdfText('Depósito\nBeto')).toBe('Depósito\nBeto')
  })
})

describe('statement references', () => {
  it('names one wallet by its short id and the general one as such', () => {
    expect(statementFolio(october, [statement('7f3e2a10-aaaa-bbbb', 'MXN')], false)).toBe('EC-202610-7F3E2A10')
    expect(statementFolio(october, [statement('a', 'MXN'), statement('b', 'USD')], true)).toBe('EC-202610-GEN')
  })

  it('names a period of days by its first and last day', () => {
    expect(statementFolio(quarter, [statement('a', 'MXN'), statement('b', 'USD')], true)).toBe('EC-20260901-20261106-GEN')
    expect(statementFileName({ holder, period: quarter, general: false, wallets: [statement('a', 'MXN')] }))
      .toBe('estado-de-cuenta-mxn-2026-09-01_2026-11-06.pdf')
  })

  it('names the file after the currency, or as the general statement', () => {
    expect(statementFileName({ holder, period: october, general: false, wallets: [statement('a', 'USD')] }))
      .toBe('estado-de-cuenta-usd-2026-10.pdf')
    expect(statementFileName({ holder, period: october, general: true, wallets: [statement('a', 'USD')] }))
      .toBe('estado-de-cuenta-general-2026-10.pdf')
  })
})

describe('buildStatementPdf', () => {
  it('builds a PDF of one wallet, long enough to need several pages', async () => {
    const pdf = await buildStatementPdf({ holder, period: october, general: false, wallets: [statement('a', 'MXN', 80)] })

    expect(pdf.type).toBe('application/pdf')
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(new TextDecoder('latin1').decode(bytes).match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1)
  })

  it('builds the general one, with wallets that moved nothing too', async () => {
    const pdf = await buildStatementPdf({
      holder, period: october, general: true, wallets: [statement('a', 'MXN', 3), statement('b', 'USD')],
    })

    expect(new TextDecoder('latin1').decode(new Uint8Array(await pdf.arrayBuffer())).match(/\/Type \/Page\b/g)).toHaveLength(1)
  })
})
