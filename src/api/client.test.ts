import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import { ApiError, RequestTimeoutError } from './errors'

// openapi-fetch takes globalThis.fetch when the client is created, so the stub must exist before the import
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<(input: Request | string, init?: RequestInit) => Promise<Response>>()
  globalThis.fetch = mock as typeof fetch
  return mock
})

const { api, refreshSession, setSessionExpiredHandler, unwrap } = await import('./client')
const { session } = await import('./session')

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const isRefresh = (input: Request | string) => String(input instanceof Request ? input.url : input).endsWith('/auth/refresh')

/** Answers the refresh with refreshAnswer; every other call is 401 for oldToken and ok for anything else. */
function serve(refreshAnswer: () => Response, oldToken = 'old') {
  fetchMock.mockImplementation(async (input) => {
    if (isRefresh(input)) {
      return refreshAnswer()
    }
    const request = input as Request
    return request.headers.get('Authorization') === `Bearer ${oldToken}`
      ? json(401, { code: 'UNAUTHORIZED' })
      : json(200, [])
  })
}

const apiCalls = () => fetchMock.mock.calls.map(([input]) => input).filter((input) => !isRefresh(input)) as Request[]
const refreshCalls = () => fetchMock.mock.calls.filter(([input]) => isRefresh(input))

beforeEach(() => {
  fetchMock.mockReset()
  // jsdom has no Web Locks; one tab only needs the lock to run the callback
  vi.stubGlobal('navigator', { ...navigator, locks: { request: (_: string, run: () => unknown) => run() } })
  session.clear()
})

afterEach(() => {
  setSessionExpiredHandler(() => {})
})

describe('language', () => {
  it('tells the API the language the app shows', async () => {
    fetchMock.mockImplementation(async () => json(200, []))

    await i18n.changeLanguage('en')
    await api.GET('/api/v1/wallets')
    await i18n.changeLanguage('es')
    await api.GET('/api/v1/wallets')

    expect(apiCalls().map((request) => request.headers.get('Accept-Language'))).toEqual(['en', 'es'])
  })
})

describe('api', () => {
  it('sends the access token on every call', async () => {
    session.store('abc')
    fetchMock.mockResolvedValue(json(200, []))

    await unwrap(api.GET('/api/v1/wallets'))

    expect(apiCalls()[0]!.headers.get('Authorization')).toBe('Bearer abc')
  })

  it('renews an expired token once and retries the call with the same body and Idempotency-Key', async () => {
    session.store('old')
    serve(() => json(200, { accessToken: 'new' }))

    const body = { sourceWalletId: '6a1d1e2a-7b8f-4d5e-9c0a-1b2c3d4e5f60', recipientEmail: 'ana@example.com', amount: 50 }
    await unwrap(api.POST('/api/v1/transfers', { params: { header: { 'Idempotency-Key': 'key-1' } }, body }))

    const [first, retry] = apiCalls()
    expect(refreshCalls()).toHaveLength(1)
    expect(first!.headers.get('Authorization')).toBe('Bearer old')
    expect(retry!.headers.get('Authorization')).toBe('Bearer new')
    expect(retry!.headers.get('Idempotency-Key')).toBe('key-1')
    expect(await retry!.json()).toEqual(body)
    expect(session.accessToken()).toBe('new')
  })

  it('shares one refresh among calls that expire at the same time', async () => {
    session.store('old')
    serve(() => json(200, { accessToken: 'new' }))

    await Promise.all([
      unwrap(api.GET('/api/v1/wallets')),
      unwrap(api.GET('/api/v1/bank-accounts')),
      unwrap(api.GET('/api/v1/notifications/unread-count')),
    ])

    expect(refreshCalls()).toHaveLength(1)
    expect(apiCalls()).toHaveLength(6)
  })

  it('signs out when the session can no longer be renewed', async () => {
    session.store('old')
    serve(() => json(401, { code: 'INVALID_TOKEN' }))
    const expired = vi.fn()
    setSessionExpiredHandler(expired)

    await expect(unwrap(api.GET('/api/v1/wallets'))).rejects.toMatchObject({ status: 401 })

    expect(expired).toHaveBeenCalledOnce()
    expect(session.accessToken()).toBeNull()
    expect(session.mayBeSignedIn()).toBe(false)
  })

  it("doesn't try to renew a call made without a session", async () => {
    fetchMock.mockResolvedValue(json(401, { code: 'INVALID_CREDENTIALS' }))

    const call = unwrap(api.POST('/api/v1/auth/login', { body: { email: 'ana@example.com', password: 'x' } }))

    await expect(call).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
    expect(refreshCalls()).toHaveLength(0)
  })
})

describe('timeouts', () => {
  // Never answers, like a stuck server: only giving up can end the call
  function hang() {
    fetchMock.mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('gives up on a call the API does not answer', async () => {
    hang()

    const call = unwrap(api.GET('/api/v1/wallets'))
    const outcome = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(30_000)

    await outcome
  })

  it('gives an upload longer', async () => {
    hang()
    const settled = vi.fn()

    const form = new FormData()
    form.append('file', new Blob(['x']), 'x.txt')
    const call = unwrap(api.POST('/api/v1/support/conversation/attachments', {
      body: form as never,
      bodySerializer: (body) => body as never,
    })).catch((error: unknown) => {
      settled()
      return error
    })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(90_000)

    expect(await call).toBeInstanceOf(RequestTimeoutError)
  })

  it('leaves an answer that arrives in time alone', async () => {
    fetchMock.mockResolvedValue(json(200, []))

    await expect(unwrap(api.GET('/api/v1/wallets'))).resolves.toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('tells a call cancelled by the screen apart from one that took too long', async () => {
    hang()
    const controller = new AbortController()

    const call = unwrap(api.GET('/api/v1/wallets', { signal: controller.signal })).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(1)
    controller.abort()

    expect(await call).not.toBeInstanceOf(RequestTimeoutError)
  })

  it('does not sign anyone out when renewing the session gets no answer', async () => {
    session.store('old')
    hang()

    const refresh = refreshSession()
    const outcome = expect(refresh).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(30_000)

    await outcome
    expect(session.accessToken()).toBe('old')
  })
})

describe('refreshSession', () => {
  it('asks for a browser session and stores the new token', async () => {
    fetchMock.mockResolvedValue(json(200, { accessToken: 'fresh' }))

    await expect(refreshSession()).resolves.toBe(true)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:3000/api/v1/auth/refresh')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', headers: { 'X-Session-Mode': 'cookie' } })
    expect(session.accessToken()).toBe('fresh')
  })

  it('rejects when the API is down, so the user is not signed out', async () => {
    session.store('old')
    fetchMock.mockResolvedValue(json(503, { code: 'SERVICE_UNAVAILABLE' }))

    const refresh = refreshSession()

    await expect(refresh).rejects.toBeInstanceOf(ApiError)
    await expect(refresh).rejects.toMatchObject({ status: 503 })
    expect(session.accessToken()).toBe('old')
  })

  it('can run again once the previous refresh finished', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { accessToken: 'one' })).mockResolvedValueOnce(json(200, { accessToken: 'two' }))

    await refreshSession()
    await refreshSession()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(session.accessToken()).toBe('two')
  })
})
