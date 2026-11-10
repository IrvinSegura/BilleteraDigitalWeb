import { createContext, use } from 'react'

export type Role = 'USER' | 'SUPPORT' | 'ADMIN'

export interface User {
  id: string
  email: string
  fullName: string
  /** E.164, as the API stores it */
  phone?: string
  role: Role
  emailVerified: boolean
  twoFactorEnabled: boolean
  /** The account still has the password it was emailed: it can do nothing else until it replaces it */
  mustChangePassword: boolean
  /** The language of the user's emails, kept in step with the one the app shows */
  language?: string
  createdAt: string | undefined
}

export type AuthState =
  | { status: 'loading' }
  // previousUserId: who the session that just ended belonged to, so their page isn't reopened for someone else
  | { status: 'signed-out'; previousUserId?: string }
  // The session couldn't be checked because the API didn't answer; the session itself may be fine
  | { status: 'unavailable' }
  // offlineSince: opened without a connection, showing the data saved then; there is no access token
  | { status: 'signed-in'; user: User; offlineSince?: number }

export interface Auth {
  state: AuthState
  /** Checks the session again after the API was unavailable. */
  retry: () => void
  /** twoFactorCode only for accounts with two-factor on; without it the API answers TWO_FACTOR_REQUIRED. */
  /** With resendVerification, an account whose email isn't verified yet also gets a new link (and still fails). */
  login: (email: string, password: string, twoFactorCode?: string, options?: { resendVerification?: boolean }) => Promise<void>
  /** Reloads the profile after something changed it (email verified, two-factor turned on or off). */
  refreshUser: () => Promise<void>
  /** Changes the name and phone; a field left undefined keeps its value, an empty phone removes it. */
  updateProfile: (changes: { fullName?: string; phone?: string }) => Promise<void>
  /** Changes the password; the API ends every other session and hands this one new tokens. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const auth = use(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return auth
}

/** For screens that only render when signed in (behind <RequireAuth>); throws otherwise. */
export function useUser(): User {
  const { state } = useAuth()
  if (state.status !== 'signed-in') {
    throw new Error('useUser needs a signed-in user')
  }
  return state.user
}
