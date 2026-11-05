import createClient, { type Middleware } from 'openapi-fetch'

import { currentLanguage } from '@/i18n'

import { ApiError, type Problem } from './errors'
import type { components, paths } from './schema'
import { session } from './session'

export type Schemas = components['schemas']

const baseUrl = import.meta.env.VITE_API_URL ?? ''

/**
 * Asks the API for a browser session: the refresh token travels only in an HttpOnly cookie scoped to /api/v1/auth,
 * and the API accepts that cookie only with this header, which other sites can't add without passing CORS.
 */
export const BROWSER_SESSION = { 'X-Session-Mode': 'cookie' } as const

let onSessionExpired: () => void = () => {}

/**
 * Replaces the handler run when an authenticated call gets a 401 and the session can't be renewed,
 * so the app can go back to the login screen.
 */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

// Refresh tokens are rotated on every use and reusing an old one revokes the session, so two refreshes must
// never run at once: one at a time per tab (shared promise) and across tabs (Web Lock). The cookie always holds
// the newest token, so whoever goes next sends the one the previous refresh set.
let refreshing: Promise<boolean> | null = null

/**
 * Trades the refresh cookie for a new access token: true once it is stored, false when the API refuses it (no
 * session, or it expired or was revoked). The API being down (network error or 5xx) rejects instead, so that is
 * never mistaken for a signed-out user. Calls made meanwhile share it.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= navigator.locks
    .request('wallet.refresh', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: BROWSER_SESSION,
        credentials: 'include',
      })
      if (response.status === 401) {
        session.clear()
        return false
      }
      if (!response.ok) {
        throw new ApiError(response.status, (await response.json().catch(() => undefined)) as Problem | undefined)
      }
      const tokens = (await response.json()) as Schemas['TokenResponse']
      session.store(tokens.accessToken!)
      return true
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// Unsent copies of authenticated requests: sending consumes the body, so a retry needs its own.
const unsent = new WeakMap<Request, Request>()

/**
 * Adds the access token. A 401 on an authenticated call means it expired: renew it once and retry with the
 * same body and headers (a transfer keeps its Idempotency-Key, so it isn't doubled).
 */
const auth: Middleware = {
  onRequest({ request }) {
    // What the emails sent before signing in are written in; once signed in, they follow the account's language
    request.headers.set('Accept-Language', currentLanguage())
    const token = session.accessToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
      unsent.set(request, request.clone())
    }
    return request
  },

  async onResponse({ request, response, options }) {
    const copy = unsent.get(request)
    if (response.status !== 401 || !copy) {
      return response
    }
    if (!(await refreshSession())) {
      onSessionExpired()
      return response
    }
    copy.headers.set('Authorization', `Bearer ${session.accessToken()}`)
    return options.fetch(copy)
  },
}

/**
 * Typed API client; pass its calls to unwrap. An expired session is renewed once per call and the call retried.
 * Credentials are included so the refresh cookie also works when the API is on another origin of the same site.
 */
export const api = createClient<paths>({ baseUrl, credentials: 'include' })
api.use(auth)

/** Unwraps an openapi-fetch result: the data, or throws an ApiError with the ProblemDetail. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) {
    throw new ApiError(response.status, error as Problem | undefined)
  }
  return data as T
}
