import { vi } from 'vitest'

import type { Auth, User } from '@/auth/auth-context'

export function testUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ana@example.com',
    fullName: 'Ana López',
    role: 'USER',
    emailVerified: true,
    twoFactorEnabled: false,
    mustChangePassword: false,
    language: 'es',
    createdAt: '2026-01-15T12:00:00Z',
    ...overrides,
  }
}

/**
 * The session tests see. Mock the auth context with it:
 * `vi.mock('@/auth/auth-context', async (original) => ({ ...await original(), ...(await import('@/test/auth')).authMock }))`
 * then set `auth.user` (null is signed out) and the functions' results in each test.
 */
export const auth = {
  user: testUser() as User | null,
  login: vi.fn<Auth['login']>(),
  retry: vi.fn<Auth['retry']>(),
  refreshUser: vi.fn<Auth['refreshUser']>(),
  updateProfile: vi.fn<Auth['updateProfile']>(),
  changePassword: vi.fn<Auth['changePassword']>(),
  logout: vi.fn<Auth['logout']>(),
  /** Back to a signed-in, verified user without two-factor, and functions that succeed. */
  reset(user: User | null = testUser()) {
    auth.user = user
    for (const fn of [auth.login, auth.retry, auth.refreshUser, auth.updateProfile, auth.changePassword, auth.logout]) {
      fn.mockReset()
      fn.mockResolvedValue(undefined as never)
    }
  },
}

function useAuth(): Auth {
  return {
    state: auth.user ? { status: 'signed-in', user: auth.user } : { status: 'signed-out' },
    retry: auth.retry,
    login: auth.login,
    refreshUser: auth.refreshUser,
    updateProfile: auth.updateProfile,
    changePassword: auth.changePassword,
    logout: auth.logout,
  }
}

function useUser(): User {
  if (!auth.user) {
    throw new Error('useUser needs a signed-in user')
  }
  return auth.user
}

export const authMock = { useAuth, useUser }
