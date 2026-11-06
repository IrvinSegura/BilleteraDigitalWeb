import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { NotificationsPage } = await import('./NotificationsPage')

const notice = (id: string, read: boolean) => ({
  id, type: 'GENERIC', title: `Aviso ${id}`, body: 'Texto', read, createdAt: '2026-11-01T12:00:00Z',
})
const pageOf = (items: unknown[], page = 0, hasNext = false) => ({ items, page, size: 20, hasNext })

describe('NotificationsPage deleting', () => {
  beforeEach(() => {
    api.reset()
    toast.success.mockReset()
    toast.error.mockReset()
    api.on('GET', '/api/v1/notifications/unread-count', { count: 1 })
    api.on('GET', '/api/v1/notifications', pageOf([notice('n-1', false), notice('n-2', true)]))
    api.on('DELETE', '/api/v1/notifications/{notificationId}', json(204))
    api.on('DELETE', '/api/v1/notifications/read', { deleted: 1 })
  })

  it('deletes one notice from beside it, without opening it', async () => {
    renderWithProviders(<NotificationsPage />)

    const buttons = await screen.findAllByRole('button', { name: 'Eliminar aviso' })
    expect(buttons).toHaveLength(2)
    await userEvent.click(buttons[1]!)

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Aviso eliminado.'))
    expect(api.callsTo('DELETE', '/api/v1/notifications/{notificationId}').map((c) => c.path)).toEqual(['/api/v1/notifications/n-2'])
    expect(api.callsTo('POST', '/api/v1/notifications/{notificationId}/read')).toHaveLength(0)
  })

  it('deletes every read notice at once', async () => {
    renderWithProviders(<NotificationsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Borrar leídos' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Borramos los avisos leídos.'))
    expect(api.callsTo('DELETE', '/api/v1/notifications/read')).toHaveLength(1)
  })

  it('offers to delete read notices only when some are shown', async () => {
    api.on('GET', '/api/v1/notifications', pageOf([notice('n-1', false)]))
    renderWithProviders(<NotificationsPage />)

    expect(await screen.findAllByRole('button', { name: 'Eliminar aviso' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Borrar leídos' })).not.toBeInTheDocument()
  })

  it('says why a notice could not be deleted', async () => {
    api.on('DELETE', '/api/v1/notifications/{notificationId}', problem(404, 'NOTIFICATION_NOT_FOUND'))
    renderWithProviders(<NotificationsPage />)

    await userEvent.click((await screen.findAllByRole('button', { name: 'Eliminar aviso' }))[0]!)

    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce())
    expect(toast.success).not.toHaveBeenCalled()
  })
})
