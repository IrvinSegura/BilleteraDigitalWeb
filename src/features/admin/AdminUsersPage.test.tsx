import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { problem, stubApi } from '@/test/api'
import { currentLocation, renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ state: { status: 'signed-out' }, logout: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { toast } = await import('sonner')

const { AdminUsersPage } = await import('./AdminUsersPage')

const ID = '3f2a91bc-1111-4222-8333-444455556666'
const ana = {
  id: ID, email: 'ana@example.com', fullName: 'Ana López', role: 'USER', status: 'ACTIVE',
  emailVerified: true, locked: false, createdAt: '2026-10-01T12:00:00Z',
}
const beto = {
  id: '7f0c2a9e-0000-4000-8000-000000000001', email: 'beto@example.com', fullName: 'Beto Ruiz', role: 'USER',
  status: 'DISABLED', emailVerified: false, locked: true, createdAt: '2026-09-01T12:00:00Z',
}
const page = (items: unknown[], hasNext = false, number = 0) => ({ items, page: number, size: 20, hasNext })
const lastList = () => api.calls.filter((c) => c.path === '/api/v1/admin/users').at(-1)!

function open(route = '/admin/users') {
  return renderWithProviders(<AdminUsersPage />, { route, path: '/admin/users/:userId?' })
}

const created = { ...ana, id: ID, email: 'laura@example.com', fullName: 'Laura Díaz', role: 'SUPPORT' }

async function fillStaffForm() {
  await userEvent.click(screen.getByRole('button', { name: 'Crear nuevo admin/soporte' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.type(within(dialog).getByLabelText('Nombre completo'), 'Laura Díaz')
  await userEvent.type(within(dialog).getByLabelText('Correo de trabajo'), 'laura@example.com')
  await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Se une al equipo')
  return dialog
}

describe('creating a team account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.reset()
    api.on('GET', '/api/v1/admin/users', page([ana]))
    api.on('GET', '/api/v1/admin/users/stats', { total: 1, active: 1, disabled: 0, unverified: 0, admins: 0 })
    api.on('GET', '/api/v1/admin/users/{userId}', created)
    api.on('GET', '/api/v1/admin/users/{userId}/wallets', [])
  })

  it('names what it creates by the role chosen in a select', async () => {
    open()
    const dialog = await fillStaffForm()
    expect(within(dialog).getByRole('button', { name: 'Crear nuevo soporte' })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Rol' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Administrador' }))

    expect(within(dialog).getByRole('button', { name: 'Crear nuevo admin' })).toBeInTheDocument()
  })

  it('says the data goes by email, shows no password and opens the new account', async () => {
    api.on('POST', '/api/v1/admin/users', created)
    open()
    const dialog = await fillStaffForm()
    expect(within(dialog).getByText(/Le enviaremos por correo su rol/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear nuevo soporte' }))

    await waitFor(() => expect(currentLocation()).toBe(`/admin/users/${ID}`))
    expect(api.callsTo('POST', '/api/v1/admin/users')[0]!.body).toEqual({
      email: 'laura@example.com', fullName: 'Laura Díaz', role: 'SUPPORT', reason: 'Se une al equipo',
    })
    expect(toast.success).toHaveBeenCalledWith('Cuenta creada. Enviamos sus datos de acceso a laura@example.com.')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText(/contraseña/i)).not.toBeInTheDocument()
  })

  it('stays open and says why when the account cannot be created', async () => {
    api.on('POST', '/api/v1/admin/users', problem(409, 'EMAIL_ALREADY_REGISTERED'))
    open()
    const dialog = await fillStaffForm()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear nuevo soporte' }))

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(currentLocation()).toBe('/admin/users')
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('AdminUsersPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', '/api/v1/admin/users', page([ana, beto]))
    api.on('GET', '/api/v1/admin/users/stats', { total: 1200, active: 1190, disabled: 10, unverified: 35, admins: 2 })
  })

  it('shows how many accounts there are of each kind', async () => {
    open()
    const stats = screen.getByLabelText('Resumen de cuentas')
    await waitFor(() => expect(within(stats).getByText('Deshabilitadas').nextSibling).toHaveTextContent('10'))
    expect(within(stats).getByText('Cuentas').nextSibling).toHaveTextContent('1,200')
    expect(within(stats).getByText('Sin verificar').nextSibling).toHaveTextContent('35')
    expect(within(stats).getByText('Administradores').nextSibling).toHaveTextContent('2')
  })

  it('makes an account a support agent, and back, with a reason', async () => {
    api.on('GET', '/api/v1/admin/users/{userId}', ana)
    api.on('GET', '/api/v1/admin/users/{userId}/wallets', [])
    api.on('POST', '/api/v1/admin/users/{userId}/role', { ...ana, role: 'SUPPORT' })
    open(`/admin/users/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Hacer agente de soporte' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Se une al equipo')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hacer agente de soporte' }))

    expect(await screen.findByRole('button', { name: 'Quitar de soporte' })).toBeInTheDocument()
    expect(api.callsTo('POST', '/api/v1/admin/users/{userId}/role')[0]!.body).toEqual({ role: 'SUPPORT', reason: 'Se une al equipo' })
  })

  it('never offers to change the role of the administrator', async () => {
    api.on('GET', '/api/v1/admin/users/{userId}', { ...ana, role: 'ADMIN' })
    api.on('GET', '/api/v1/admin/users/{userId}/wallets', [])
    open(`/admin/users/${ID}`)

    await screen.findByText('ana@example.com')
    expect(screen.queryByRole('button', { name: 'Hacer agente de soporte' })).not.toBeInTheDocument()
  })

  it('lists the accounts, each linking to its detail, and flags what stands out', async () => {
    open()
    const link = await screen.findByRole('link', { name: 'Ana López' })
    expect(link).toHaveAttribute('href', `/admin/users/${ID}`)
    const row = screen.getByRole('link', { name: 'Beto Ruiz' }).closest('tr')!
    expect(within(row).getByText('Deshabilitada')).toBeInTheDocument()
    expect(within(row).getByText('Bloqueada')).toBeInTheDocument()
    expect(within(row).getByText('Sin verificar')).toBeInTheDocument()
  })

  it('filters by status and role, going back to the first page and keeping them in the address', async () => {
    api.on('GET', '/api/v1/admin/users', page([ana], true))
    open('/admin/users?page=2')
    await screen.findByRole('link', { name: 'Ana López' })
    expect(lastList().query.get('page')).toBe('2')

    await userEvent.click(screen.getByRole('combobox', { name: 'Estado de la cuenta' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Deshabilitadas' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo de usuario' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Administrador' }))

    await waitFor(() => expect(lastList().query.get('role')).toBe('ADMIN'))
    expect(lastList().query.get('status')).toBe('DISABLED')
    expect(lastList().query.get('page')).toBe('0')
    expect(currentLocation()).toBe('/admin/users?status=DISABLED&role=ADMIN')
  })

  it('moves between pages through the address', async () => {
    api.on('GET', '/api/v1/admin/users', page([ana], true))
    open()
    await screen.findByRole('link', { name: 'Ana López' })
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(lastList().query.get('page')).toBe('1'))
    expect(currentLocation()).toBe('/admin/users?page=1')
  })

  it('ignores a filter in the address that the API would refuse', async () => {
    open('/admin/users?status=NOPE&role=ROOT&page=-3')
    await screen.findByRole('link', { name: 'Ana López' })
    expect(lastList().query.has('status')).toBe(false)
    expect(lastList().query.has('role')).toBe(false)
    expect(lastList().query.get('page')).toBe('0')
  })

  it('says when no account matches', async () => {
    api.on('GET', '/api/v1/admin/users', page([]))
    open('/admin/users?status=DISABLED')
    expect(await screen.findByText('No hay cuentas')).toBeInTheDocument()
  })

  it('asks for two-factor instead of a bare error, and keeps the counts as placeholders', async () => {
    api.on('GET', '/api/v1/admin/users', problem(403, 'ADMIN_TWO_FACTOR_REQUIRED'))
    api.on('GET', '/api/v1/admin/users/stats', problem(403, 'ADMIN_TWO_FACTOR_REQUIRED'))
    open()
    expect(await screen.findByText('Activa la verificación en dos pasos')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Cuentas').nextSibling).toHaveTextContent('—'))
  })

  it('opens an account with a way back to the list instead of the list itself', async () => {
    api.on('GET', '/api/v1/admin/users/{userId}', { ...ana, twoFactorEnabled: false })
    api.on('GET', '/api/v1/admin/users/{userId}/wallets', [])
    open(`/admin/users/${ID}`)
    expect(await screen.findByText('Este usuario no tiene billeteras.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Todos los usuarios' })).toHaveAttribute('href', '/admin/users')
    expect(screen.queryByRole('combobox', { name: 'Tipo de usuario' })).not.toBeInTheDocument()
    expect(api.calls.some((c) => c.path === '/api/v1/admin/users')).toBe(false)
  })

  it('refreshes the list and the counts after an account changes', async () => {
    api.on('GET', '/api/v1/admin/users/{userId}', { ...ana, twoFactorEnabled: false })
    api.on('GET', '/api/v1/admin/users/{userId}/wallets', [])
    api.on('POST', '/api/v1/admin/users/{userId}/disable', { ...ana, status: 'DISABLED', twoFactorEnabled: false })
    const { client } = open(`/admin/users/${ID}`)
    client.setQueryData(['admin', 'users', 'stats'], { total: 1 })
    client.setQueryData(['admin', 'users', 'list', '', '', 0], page([ana]))

    await userEvent.click(await screen.findByRole('button', { name: 'Deshabilitar' }))
    await userEvent.type(screen.getByLabelText('Motivo'), 'Revisión')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deshabilitar' }))

    await waitFor(() => expect(client.getQueryState(['admin', 'users', 'stats'])?.isInvalidated).toBe(true))
    expect(client.getQueryState(['admin', 'users', 'list', '', '', 0])?.isInvalidated).toBe(true)
  })

  describe('closed accounts', () => {
    it('can be listed on their own', async () => {
      open()
      await screen.findByRole('link', { name: 'Ana López' })

      await userEvent.click(screen.getByRole('combobox', { name: 'Estado de la cuenta' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Cerradas' }))

      await waitFor(() => expect(lastList().query.get('status')).toBe('CLOSED'))
      expect(currentLocation()).toBe('/admin/users?status=CLOSED')
    })

    it('offer nothing to change, since their owner closed them for good', async () => {
      api.on('GET', '/api/v1/admin/users/{userId}', { ...ana, status: 'CLOSED' })
      api.on('GET', '/api/v1/admin/users/{userId}/wallets', [])
      open(`/admin/users/${ID}`)

      await screen.findByText('ana@example.com')
      expect(screen.getAllByText('Cerrada').length).toBeGreaterThan(0)
      for (const name of ['Deshabilitar', 'Habilitar', 'Hacer agente de soporte']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
    })
  })
})
