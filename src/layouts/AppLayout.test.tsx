import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/test/api'
import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))
// No live connection in tests: the counts come from the API alone
vi.mock('@/features/notifications/live', () => ({ useLiveNotifications: () => {} }))

const { AppLayout } = await import('./AppLayout')

const TICKETS = '/api/v1/admin/support/tickets'
const IDENTITY = '/api/v1/admin/identity-verifications'
const ADJUSTMENTS = '/api/v1/admin/adjustments'
const MY_TICKETS = '/api/v1/support/agent/tickets'

function sidebar() {
  return within(screen.getAllByRole('navigation', { name: 'Principal' })[0]!)
}

describe('AppLayout menu counts', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', '/api/v1/notifications/unread-count', { count: 2 })
    api.on('GET', TICKETS, { items: [], page: 0, size: 1, hasNext: true, open: 3 })
    api.on('GET', IDENTITY, { items: [], page: 0, size: 1, hasNext: true, pending: 5 })
    api.on('GET', ADJUSTMENTS, { items: [], page: 0, size: 1, hasNext: true, pending: 1 })
  })

  it('shows an administrator how many tickets wait for them', async () => {
    auth.reset(testUser({ role: 'ADMIN' }))
    renderWithProviders(<AppLayout />)

    expect(await sidebar().findByRole('link', { name: /^Tickets\s*3$/ })).toHaveAttribute('href', '/admin/tickets')
    expect(api.callsTo('GET', TICKETS)[0]!.query.get('status')).toBe('OPEN')
  })

  it('keeps an administrator\'s notices and account last in the same group, below the audit log', async () => {
    auth.reset(testUser({ role: 'ADMIN' }))
    renderWithProviders(<AppLayout />)

    const links = (await sidebar().findAllByRole('link')).map((link) => link.getAttribute('href'))
    expect(links.slice(-3)).toEqual(['/admin/audit', '/notifications', '/settings'])
    expect(links.filter((href) => href === '/notifications')).toHaveLength(1)
  })

  it('counts the INE to review and the adjustments to approve the same way', async () => {
    auth.reset(testUser({ role: 'ADMIN' }))
    renderWithProviders(<AppLayout />)

    expect(await sidebar().findByRole('link', { name: /^Identidad\s*5$/ })).toHaveAttribute('href', '/admin/identity')
    expect(await sidebar().findByRole('link', { name: /^Ajustes\s*1$/ })).toHaveAttribute('href', '/admin/adjustments')
    expect(sidebar().getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/admin')
    expect(api.callsTo('GET', IDENTITY)[0]!.query.get('status')).toBe('PENDING_REVIEW')
    expect(api.callsTo('GET', ADJUSTMENTS)[0]!.query.get('status')).toBe('PENDING_APPROVAL')
  })

  it('never asks for them for anyone else', async () => {
    auth.reset(testUser({ role: 'SUPPORT' }))
    renderWithProviders(<AppLayout />)

    expect(await sidebar().findByRole('link', { name: /^Notificaciones\s*2$/ })).toBeInTheDocument()
    expect(api.callsTo('GET', TICKETS)).toHaveLength(0)
    expect(api.callsTo('GET', IDENTITY)).toHaveLength(0)
    expect(api.callsTo('GET', ADJUSTMENTS)).toHaveLength(0)
  })

  it('shows an agent how many of their escalated tickets still wait, and nobody else', async () => {
    api.on('GET', MY_TICKETS, { items: [], page: 0, size: 1, hasNext: true, open: 2 })
    auth.reset(testUser({ role: 'SUPPORT' }))
    const { unmount } = renderWithProviders(<AppLayout />)

    expect(await sidebar().findByRole('link', { name: /^Escalados\s*2$/ })).toHaveAttribute('href', '/support/escalated')
    expect(api.callsTo('GET', MY_TICKETS)[0]!.query.get('status')).toBe('OPEN')
    unmount()

    api.reset()
    api.on('GET', '/api/v1/notifications/unread-count', { count: 0 })
    auth.reset(testUser({ role: 'ADMIN' }))
    renderWithProviders(<AppLayout />)
    await sidebar().findByRole('link', { name: /^Tickets/ })
    expect(api.callsTo('GET', MY_TICKETS)).toHaveLength(0)
  })
})

describe('AppLayout side menu', () => {
  beforeEach(() => {
    api.reset()
    api.on('GET', '/api/v1/notifications/unread-count', { count: 0 })
  })

  it.each(['USER', 'SUPPORT', 'ADMIN'] as const)('lets a %s hide the menu and finds it hidden next time', async (role) => {
    auth.reset(testUser({ role }))
    const user = userEvent.setup()
    const { unmount } = renderWithProviders(<AppLayout />)

    const hide = screen.getByRole('button', { name: 'Ocultar menú lateral' })
    expect(hide).toHaveAttribute('aria-expanded', 'true')
    await user.click(hide)

    const show = screen.getByRole('button', { name: 'Mostrar menú lateral' })
    expect(show).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('app-sidebar')).toHaveAttribute('inert')
    unmount()

    renderWithProviders(<AppLayout />)
    await user.click(screen.getByRole('button', { name: 'Mostrar menú lateral' }))
    expect(document.getElementById('app-sidebar')).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Ocultar menú lateral' })).toHaveAttribute('aria-expanded', 'true')
  })
})
