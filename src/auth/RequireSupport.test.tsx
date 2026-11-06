import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

vi.mock('@/auth/auth-context', async (original) => ({ ...await original<object>(), ...(await import('@/test/auth')).authMock }))

const { RequireSupport } = await import('./RequireAuth')

function open() {
  renderWithProviders(
    <Routes>
      <Route path="/" element={<p>Inicio</p>} />
      <Route path="/support/inbox" element={<RequireSupport />}><Route index element={<p>Bandeja</p>} /></Route>
    </Routes>,
    { route: '/support/inbox' },
  )
}

describe('RequireSupport', () => {
  it.each(['USER', 'ADMIN'] as const)('sends a %s home', (role) => {
    auth.reset(testUser({ role }))
    open()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Bandeja')).not.toBeInTheDocument()
  })

  it('lets an agent in', () => {
    auth.reset(testUser({ role: 'SUPPORT' }))
    open()
    expect(screen.getByText('Bandeja')).toBeInTheDocument()
  })
})
