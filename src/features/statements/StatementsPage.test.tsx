import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth } from '@/test/auth'
import { mxnWallet, usdWallet } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
const pdf = vi.hoisted(() => ({ build: vi.fn(), save: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('./statement-pdf', () => ({
  buildStatementPdf: pdf.build,
  statementFileName: (d: { general: boolean; month: string }) => `${d.general ? 'general' : 'one'}-${d.month}.pdf`,
}))
vi.mock('@/lib/download', () => ({ saveFile: pdf.save }))
vi.mock('sonner', () => ({ toast: { success: pdf.success, error: pdf.error } }))

const { StatementsPage } = await import('./StatementsPage')

const money = (amount: string, currency: string) => ({ amount, currency })
const summary = (currency: string) => ({
  month: '2026-10', openingBalance: money('100.00', currency), moneyIn: money('40.00', currency),
  moneyOut: money('15.00', currency), closingBalance: money('125.00', currency),
})

function render(route = '/statements?month=2026-10') {
  return renderWithProviders(<StatementsPage />, { route, path: '/statements' })
}

describe('StatementsPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    pdf.build.mockReset().mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }))
    pdf.save.mockReset()
    pdf.success.mockReset()
    pdf.error.mockReset()
    api.on('GET', '/api/v1/wallets', [mxnWallet, usdWallet])
    api.on('GET', '/api/v1/wallets/{walletId}/summary', (call) => summary(call.path.includes('usd') ? 'USD' : 'MXN'))
    api.on('GET', '/api/v1/wallets/{walletId}/movements', { items: [], page: 0, size: 100, hasNext: false })
  })

  it("shows each wallet's month and links to its statement", async () => {
    render()

    // The month picker and the general statement both name it
    expect(await screen.findAllByText('octubre de 2026')).toHaveLength(2)
    const link = await screen.findByRole('link', { name: 'Ver el estado de cuenta en USD' })
    expect(link).toHaveAttribute('href', '/wallets/wallet-usd/statement?month=2026-10')
    expect(await screen.findAllByText('$125.00')).toHaveLength(1)
    expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/summary').every((c) => c.query.get('month') === '2026-10')).toBe(true)
  })

  it('downloads the general statement with every wallet', async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /Descargar estado general/ }))

    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith(expect.any(Blob), 'general-2026-10.pdf'))
    const document = pdf.build.mock.calls[0]![0]
    expect(document).toMatchObject({ general: true, month: '2026-10', holder: { fullName: 'Ana López', email: 'ana@example.com' } })
    expect(document.wallets.map((w: { currency: string }) => w.currency)).toEqual(['MXN', 'USD'])
    expect(document.wallets[1].closingBalance).toEqual(money('125.00', 'USD'))
    expect(pdf.success).toHaveBeenCalledWith('Estado de cuenta descargado.')
  })

  it("downloads one wallet's statement on its own", async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Descargar en PDF el estado de cuenta en MXN' }))

    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith(expect.any(Blob), 'one-2026-10.pdf'))
    expect(pdf.build.mock.calls[0]![0].wallets).toHaveLength(1)
    expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/movements').every((c) => c.path.includes('wallet-mxn'))).toBe(true)
  })

  it('says why when the statement could not be built', async () => {
    api.on('GET', '/api/v1/wallets/{walletId}/movements', problem(500, 'INTERNAL_ERROR'))
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /Descargar estado general/ }))

    await waitFor(() => expect(pdf.error).toHaveBeenCalledOnce())
    expect(pdf.save).not.toHaveBeenCalled()
  })

  it('moves between months, never past the current one', async () => {
    const user = userEvent.setup()
    render('/statements')

    const next = await screen.findByRole('button', { name: 'Mes siguiente' })
    expect(next).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(next).toBeEnabled()
  })

  it('points to the wallets when there are none yet', async () => {
    api.on('GET', '/api/v1/wallets', [])
    render()

    const empty = await screen.findByText('Aún no tienes billeteras')
    expect(within(empty.closest('div')!.parentElement!).getByRole('link', { name: 'Ir a billeteras' })).toHaveAttribute('href', '/wallets')
    expect(screen.getByRole('button', { name: /Descargar estado general/ })).toBeDisabled()
  })
})
