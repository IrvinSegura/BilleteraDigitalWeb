import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/client'

import { useAuth } from './auth-context'
import { AuthProvider } from './AuthProvider'
import { GuestOnly, RequireAuth } from './RequireAuth'

const { expireSession } = vi.hoisted(() => ({ expireSession: { run: () => {} } }))

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() },
  BROWSER_SESSION: {},
  refreshSession: vi.fn(async () => false),
  setSessionExpiredHandler: (handler: () => void) => { expireSession.run = handler },
  unwrap: (call: Promise<unknown>) => call,
}))

let signedInAs = ''

beforeEach(() => {
  vi.mocked(api.POST).mockImplementation((async (_path: string, options: { body?: { email?: string } }) => {
    if (options?.body?.email) signedInAs = options.body.email
    return { accessToken: 'token' }
  }) as never)
  vi.mocked(api.GET).mockImplementation((async () => ({
    id: signedInAs,
    email: signedInAs,
    fullName: signedInAs,
    role: 'USER',
    emailVerified: true,
    twoFactorEnabled: false,
    language: 'es',
  })) as never)
})

function LoginScreen() {
  const { login } = useAuth()
  return (
    <>
      <h1>Login</h1>
      <button onClick={() => void login('ana', 'password')}>Entrar como Ana</button>
      <button onClick={() => void login('beto', 'password')}>Entrar como Beto</button>
    </>
  )
}

function WalletScreen() {
  const { logout } = useAuth()
  return (
    <>
      <h1>Billetera</h1>
      <button onClick={() => void logout()}>Salir</button>
    </>
  )
}

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginScreen />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<h1>Inicio</h1>} />
              <Route path="/wallets/1" element={<WalletScreen />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function signInAs(name: 'Ana' | 'Beto') {
  await userEvent.click(await screen.findByRole('button', { name: `Entrar como ${name}` }))
}

describe('the page to return to after signing in', () => {
  it('is the one asked for before there was a session', async () => {
    renderAt('/wallets/1')

    await signInAs('Beto')

    expect(await screen.findByRole('heading', { name: 'Billetera' })).toBeInTheDocument()
  })

  it('is the last one when the same account signs in again', async () => {
    renderAt('/wallets/1')
    await signInAs('Ana')
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))

    await signInAs('Ana')

    expect(await screen.findByRole('heading', { name: 'Billetera' })).toBeInTheDocument()
  })

  it('is home when another account signs in after signing out', async () => {
    renderAt('/wallets/1')
    await signInAs('Ana')
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))

    await signInAs('Beto')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('is home when another account signs in after the session expired', async () => {
    renderAt('/wallets/1')
    await signInAs('Ana')
    await screen.findByRole('heading', { name: 'Billetera' })
    act(() => expireSession.run())

    await signInAs('Beto')

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
