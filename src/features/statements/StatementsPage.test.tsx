import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { auth } from '@/test/auth'
import { mxnWallet, usdWallet } from '@/test/fixtures'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
const pdf = vi.hoisted(() => ({ build: vi.fn(), save: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('./statement-pdf', () => ({
  buildStatementPdf: pdf.build,
  statementFileName: (d: { general: boolean; period: { from: string; to: string } }) =>
    `${d.general ? 'general' : 'one'}-${d.period.from}_${d.period.to}.pdf`,
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

const october = { from: '2026-10-01', to: '2026-10-31' }

describe('StatementsPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    // Only the clock: the periods offered depend on today
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-06T18:00:00Z'))
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

    // A month other than the current one is a range of dates
    expect(await screen.findByRole('combobox', { name: 'Periodo' })).toHaveTextContent('Elegir fechas')
    expect(screen.getByRole('button', { name: /^Fechas del estado de cuenta: 1.31 de oct/ })).toHaveTextContent('31 días')
    expect(screen.getByText('Octubre de 2026', { selector: 'p' })).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Ver el estado de cuenta en USD' })
    expect(link).toHaveAttribute('href', '/wallets/wallet-usd/statement?month=2026-10')
    expect(await screen.findAllByText('$125.00')).toHaveLength(1)
    expect(api.callsTo('GET', '/api/v1/wallets/{walletId}/summary').every((c) =>
      c.query.get('from') === october.from && c.query.get('to') === october.to)).toBe(true)
  })

  it('downloads the general statement with every wallet', async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /Descargar estado general/ }))

    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith(expect.any(Blob), 'general-2026-10-01_2026-10-31.pdf'))
    const document = pdf.build.mock.calls[0]![0]
    expect(document).toMatchObject({ general: true, period: october, holder: { fullName: 'Ana López', email: 'ana@example.com' } })
    expect(document.wallets.map((w: { currency: string }) => w.currency)).toEqual(['MXN', 'USD'])
    expect(document.wallets[1].closingBalance).toEqual(money('125.00', 'USD'))
    expect(pdf.success).toHaveBeenCalledWith('Estado de cuenta descargado.')
  })

  it("downloads one wallet's statement on its own", async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Descargar en PDF el estado de cuenta en MXN' }))

    await waitFor(() => expect(pdf.save).toHaveBeenCalledWith(expect.any(Blob), 'one-2026-10-01_2026-10-31.pdf'))
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

  it('offers the last month, the last three months and dates of their own', async () => {
    const user = userEvent.setup()
    render('/statements')

    const picker = await screen.findByRole('combobox', { name: 'Periodo' })
    expect(picker).toHaveTextContent('Último mes')
    await user.click(picker)
    expect((await screen.findAllByRole('option')).map((option) => option.textContent))
      .toEqual(['Último mes', 'Últimos tres meses', 'Elegir fechas'])
    await user.click(screen.getByRole('option', { name: 'Últimos tres meses' }))

    await waitFor(() => expect(currentLocation()).toBe('/statements?from=2026-09-01&to=2026-11-06'))
    expect(screen.getByText(/^1 sep.* 2026 – 6 nov.* 2026$/, { selector: 'p' })).toBeInTheDocument()
  })

  it('opens the calendar right away to pick dates, and keeps the period until they are applied', async () => {
    const user = userEvent.setup()
    render('/statements')

    await user.click(await screen.findByRole('combobox', { name: 'Periodo' }))
    await user.click(await screen.findByRole('option', { name: 'Elegir fechas' }))
    const calendar = within(await screen.findByRole('dialog', { name: 'Fechas del estado de cuenta' }))

    // Starts on the days the month has had so far
    expect(calendar.getByText('Desde').nextSibling).toHaveTextContent('1 nov 2026')
    expect(calendar.getByText('Hasta').nextSibling).toHaveTextContent('6 nov 2026')
    await user.click(calendar.getByRole('button', { name: /, 2 de noviembre de 2026$/ }))
    expect(calendar.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
    await user.click(calendar.getByRole('button', { name: /, 4 de noviembre de 2026$/ }))
    await user.click(calendar.getByRole('button', { name: 'Cancelar' }))

    expect(currentLocation()).toBe('/statements')
  })

  it("keeps the dates picked on the calendar within the user's history", async () => {
    const user = userEvent.setup()
    render('/statements?from=2026-01-20&to=2026-02-10')

    await user.click(await screen.findByRole('button', { name: /^Fechas del estado de cuenta: 20 de ene.*10 de feb/ }))
    const calendar = within(await screen.findByRole('dialog', { name: 'Fechas del estado de cuenta' }))
    expect(calendar.getByRole('grid', { name: 'Febrero de 2026' })).toBeInTheDocument()
    await user.click(calendar.getByRole('button', { name: 'Mes anterior' }))

    // The oldest wallet was opened on 15 January: nothing earlier, not even the month before
    expect(calendar.getByRole('button', { name: /, 14 de enero de 2026$/ })).toHaveAttribute('aria-disabled', 'true')
    expect(calendar.getByRole('button', { name: /, 15 de enero de 2026$/ })).not.toHaveAttribute('aria-disabled')
    expect(calendar.getByRole('button', { name: 'Mes anterior' })).toBeDisabled()
    expect(calendar.getByText(/tu historial empieza el 15 ene/)).toBeInTheDocument()

    // A day before the start starts again from it
    await user.click(calendar.getByRole('button', { name: /, 22 de enero de 2026$/ }))
    await user.click(calendar.getByRole('button', { name: /, 16 de enero de 2026$/ }))
    expect(calendar.getByText('Desde').nextSibling).toHaveTextContent('16 ene 2026')
    await user.click(calendar.getByRole('button', { name: 'Mes siguiente' }))
    await user.click(calendar.getByRole('button', { name: /, 3 de febrero de 2026$/ }))
    expect(calendar.getByText('19 días')).toBeInTheDocument()
    await user.click(calendar.getByRole('button', { name: 'Aplicar' }))

    await waitFor(() => expect(currentLocation()).toBe('/statements?from=2026-01-16&to=2026-02-03'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers shortcuts, and moves between days with the keyboard', async () => {
    const user = userEvent.setup()
    render('/statements?from=2026-11-02&to=2026-11-04')

    await user.click(await screen.findByRole('button', { name: /^Fechas del estado de cuenta/ }))
    const calendar = within(await screen.findByRole('dialog', { name: 'Fechas del estado de cuenta' }))
    // The year began before the first wallet: from it on is all the user's history
    expect(calendar.getAllByRole('button', { pressed: false }).map((button) => button.textContent))
      .toEqual(['Mes pasado completo', 'Últimos 7 días', 'Últimos 30 días', 'Últimos 90 días', 'Todo tu historial'])

    await user.click(calendar.getByRole('button', { name: 'Mes pasado completo' }))
    expect(calendar.getByRole('button', { name: 'Mes pasado completo' })).toHaveAttribute('aria-pressed', 'true')
    expect(calendar.getByText('31 días')).toBeInTheDocument()

    // Today is the last day there is: the keyboard stops there
    calendar.getByRole('button', { name: /, 31 de octubre de 2026$/ }).focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName(/, 6 de noviembre de 2026$/)
    expect(calendar.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
  })

  it('ignores a link to days before the first record or in the future', async () => {
    render('/statements?from=2026-01-01&to=2026-12-31')

    // Kept within the user's history: from the first wallet until today
    expect(await screen.findByText(/^15 ene.* 2026 – 6 nov.* 2026$/, { selector: 'p' })).toBeInTheDocument()
  })

  it('points to the wallets when there are none yet', async () => {
    api.on('GET', '/api/v1/wallets', [])
    render()

    const empty = await screen.findByText('Aún no tienes billeteras')
    expect(within(empty.closest('div')!.parentElement!).getByRole('link', { name: 'Ir a billeteras' })).toHaveAttribute('href', '/wallets')
    expect(screen.getByRole('button', { name: /Descargar estado general/ })).toBeDisabled()
  })
})
