// The signed-in user's access token, only in memory. The refresh token never reaches page scripts: the API keeps
// it in an HttpOnly cookie (browser session mode), so a reload restores the session by calling /auth/refresh.
let accessToken: string | null = null

// Remembers that this browser signed in, so a visitor who never did isn't sent to /auth/refresh only to get a
// 401. It says nothing about the cookie itself, which page scripts can't see; the API still decides.
const SIGNED_IN_HINT = 'wallet.signedIn'

function setHint(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(SIGNED_IN_HINT, '1')
    } else {
      localStorage.removeItem(SIGNED_IN_HINT)
    }
  } catch {
    // Storage blocked: every load then just tries the refresh
  }
}

export const session = {
  accessToken: () => accessToken,

  /** Whether a refresh cookie may exist; when storage is unreadable, assume it may. */
  mayBeSignedIn(): boolean {
    try {
      return localStorage.getItem(SIGNED_IN_HINT) === '1'
    } catch {
      return true
    }
  },

  store(token: string) {
    accessToken = token
    setHint(true)
  },

  clear() {
    accessToken = null
    setHint(false)
  },
}
