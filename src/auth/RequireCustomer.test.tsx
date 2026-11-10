import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { auth, testUser } from '@/test/auth'
import { renderWithProviders } from '@/test/render'

vi.mock('@/auth/auth-context', async (original) => ({ ...await original<object>(), ...(await import('@/test/auth')).authMock }))

const { RequireCustomer } = await import('./RequireAuth')

function open() {
  renderWithProviders(
    <Routes>
      <Route element={<RequireCustomer />}><Route path="/wallets" element={<p>Billeteras</p>} /></Route>
      <Route path="/admin" element={<p>Consola</p>} />
      <Route path="/support/inbox" element={<p>Bandeja</p>} />
    </Routes>,
    { route: '/wallets' },
  )
}

describe('RequireCustomer', () => {
  it('lets a customer in', () => {
    auth.reset(testUser({ role: 'USER' }))
    open()
    expect(screen.getByText('Billeteras')).toBeInTheDocument()
  })

  it.each([['ADMIN', 'Consola'], ['SUPPORT', 'Bandeja']] as const)('sends a %s to their console', (role, home) => {
    auth.reset(testUser({ role }))
    open()
    expect(screen.getByText(home)).toBeInTheDocument()
    expect(screen.queryByText('Billeteras')).not.toBeInTheDocument()
  })
})
