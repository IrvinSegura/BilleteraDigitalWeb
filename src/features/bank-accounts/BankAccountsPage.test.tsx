import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { bankAccount } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))

const { BankAccountsPage } = await import('./BankAccountsPage')

// A CLABE whose check digit is right (Banamex), and the same one with the last digit changed
const VALID_CLABE = '002010077777777771'
const WRONG_CHECK_DIGIT = '002010077777777772'

async function openAddDialog() {
  await userEvent.click(screen.getByRole('button', { name: 'Agregar cuenta' }))
  return screen.findByRole('dialog')
}

describe('BankAccountsPage', () => {
  beforeEach(() => {
    api.reset()
    auth.reset()
    api.on('GET', '/api/v1/bank-accounts', [bankAccount()])
    api.on('POST', '/api/v1/bank-accounts', bankAccount({ id: 'bank-2' }))
    api.on('DELETE', '/api/v1/bank-accounts/{bankAccountId}', json(204))
  })

  it('lists the accounts and which ones can receive withdrawals', async () => {
    api.on('GET', '/api/v1/bank-accounts', [
      bankAccount(),
      bankAccount({ id: 'bank-2', clabeLastFour: '9999', withdrawalsAvailableFrom: '2099-06-15T12:00:00Z' }),
    ])
    renderWithProviders(<BankAccountsPage />)
    expect(await screen.findByText('Lista para retiros')).toBeInTheDocument()
    expect(screen.getByText(/^Disponible .*2099/)).toBeInTheDocument()
  })

  it('invites adding a CLABE when there is none', async () => {
    api.on('GET', '/api/v1/bank-accounts', [])
    renderWithProviders(<BankAccountsPage />)
    expect(await screen.findByText('Sin cuentas bancarias')).toBeInTheDocument()
  })

  it('checks the CLABE digit before sending and names the bank', async () => {
    renderWithProviders(<BankAccountsPage />)
    const dialog = await openAddDialog()
    const clabe = within(dialog).getByLabelText('CLABE interbancaria')
    await userEvent.type(clabe, WRONG_CHECK_DIGIT)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cuenta' }))
    expect(within(dialog).getByText('Revisa la CLABE: el dígito verificador no coincide')).toBeInTheDocument()
    expect(api.callsTo('POST', '/api/v1/bank-accounts')).toHaveLength(0)

    await userEvent.clear(clabe)
    await userEvent.type(clabe, '00201')
    await userEvent.tab()
    expect(within(dialog).getByText('La CLABE tiene 18 dígitos')).toBeInTheDocument()
  })

  it('saves the account with the holder name, prefilled with the user', async () => {
    renderWithProviders(<BankAccountsPage />)
    const dialog = await openAddDialog()
    expect(within(dialog).getByLabelText('Titular de la cuenta')).toHaveValue('Ana López')
    await userEvent.type(within(dialog).getByLabelText('CLABE interbancaria'), VALID_CLABE)
    expect(within(dialog).getByLabelText('CLABE interbancaria')).toHaveValue('002 010 07777777777 1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cuenta' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.callsTo('POST', '/api/v1/bank-accounts')[0]!.body).toEqual({ clabe: VALID_CLABE, holderName: 'Ana López' })
    // The list is asked for again
    await waitFor(() => expect(api.callsTo('GET', '/api/v1/bank-accounts')).toHaveLength(2))
  })

  it('needs the two-factor code when it is on', async () => {
    auth.reset(testUser({ twoFactorEnabled: true }))
    renderWithProviders(<BankAccountsPage />)
    const dialog = await openAddDialog()
    await userEvent.type(within(dialog).getByLabelText('CLABE interbancaria'), VALID_CLABE)
    const save = within(dialog).getByRole('button', { name: 'Guardar cuenta' })
    expect(save).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText('Código de verificación'), '123456')
    await userEvent.click(save)
    await waitFor(() => expect(api.callsTo('POST', '/api/v1/bank-accounts')[0]!.body).toMatchObject({ twoFactorCode: '123456' }))
  })

  it('shows what the API refused', async () => {
    api.on('POST', '/api/v1/bank-accounts', problem(409, 'BANK_ACCOUNT_ALREADY_EXISTS', 'Already added'))
    renderWithProviders(<BankAccountsPage />)
    const dialog = await openAddDialog()
    await userEvent.type(within(dialog).getByLabelText('CLABE interbancaria'), VALID_CLABE)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cuenta' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('removes an account after confirming', async () => {
    renderWithProviders(<BankAccountsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar la cuenta terminación 4321' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/terminación 4321 dejará de recibir retiros/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(api.callsTo('DELETE', '/api/v1/bank-accounts/{bankAccountId}')[0]!.path)
      .toBe('/api/v1/bank-accounts/bank-1'))
  })

  describe('naming an account', () => {
    it('shows the name first and the bank under it', async () => {
      api.on('GET', '/api/v1/bank-accounts', [bankAccount({ alias: 'Nómina' })])
      renderWithProviders(<BankAccountsPage />)

      expect(await screen.findByText('Nómina')).toBeInTheDocument()
      expect(screen.getByText(/^BBVA · /)).toBeInTheDocument()
    })

    it('saves the name, trimmed', async () => {
      api.on('PATCH', '/api/v1/bank-accounts/{bankAccountId}', bankAccount({ alias: 'Ahorro' }))
      renderWithProviders(<BankAccountsPage />)

      await userEvent.click(await screen.findByRole('button', { name: 'Ponerle nombre a la cuenta terminación 4321' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Nombre'), '  Ahorro ')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(api.callsTo('PATCH', '/api/v1/bank-accounts/{bankAccountId}')).toHaveLength(1))
      const call = api.callsTo('PATCH', '/api/v1/bank-accounts/{bankAccountId}')[0]!
      expect(call.path).toBe('/api/v1/bank-accounts/bank-1')
      expect(call.body).toEqual({ alias: 'Ahorro' })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('clears the name when left empty', async () => {
      api.on('GET', '/api/v1/bank-accounts', [bankAccount({ alias: 'Nómina' })])
      api.on('PATCH', '/api/v1/bank-accounts/{bankAccountId}', bankAccount())
      renderWithProviders(<BankAccountsPage />)

      await userEvent.click(await screen.findByRole('button', { name: 'Ponerle nombre a la cuenta terminación 4321' }))
      const dialog = await screen.findByRole('dialog')
      const input = within(dialog).getByLabelText('Nombre')
      expect(input).toHaveValue('Nómina')
      await userEvent.clear(input)
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(api.callsTo('PATCH', '/api/v1/bank-accounts/{bankAccountId}')[0]?.body).toEqual({ alias: '' }))
    })

    it('refuses markup before sending it', async () => {
      renderWithProviders(<BankAccountsPage />)

      await userEvent.click(await screen.findByRole('button', { name: 'Ponerle nombre a la cuenta terminación 4321' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Nombre'), '<b>x</b>')

      expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    })
  })
})
