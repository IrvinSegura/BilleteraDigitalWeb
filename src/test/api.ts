import { vi } from 'vitest'

/** One request the code under test sent, with its JSON body already read. */
export interface ApiCall {
  method: string
  path: string
  query: URLSearchParams
  headers: Headers
  body: unknown
}

type Reply = Response | unknown
type Handler = (call: ApiCall) => Reply | Promise<Reply>

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })

/** An API error as the API sends it: an RFC 9457 ProblemDetail with its stable code. */
export const problem = (status: number, code: string, detail = code) => json(status, { status, code, detail })

// "/api/v1/wallets/{walletId}" matches any one path segment where the placeholder is
const toPattern = (path: string) =>
  new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`)

/**
 * Replaces fetch with a small fake API. openapi-fetch keeps the fetch it finds when the client is created, so call
 * this before the first import of `@/api/client` (import the code under test dynamically, after it).
 *
 * `on` answers a method and path with a handler's result, a Response as is or anything else as a 200 JSON body; the
 * latest route for a path wins, so a test can override the defaults. Unrouted calls get a 404 NOT_STUBBED.
 */
export function stubApi() {
  const routes: { method: string; pattern: RegExp; handler: Handler }[] = []
  const calls: ApiCall[] = []

  const fetchMock = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(request.url)
    const text = await request.clone().text()
    const call: ApiCall = {
      method: request.method,
      path: url.pathname,
      query: url.searchParams,
      headers: request.headers,
      // A file upload is not JSON, and its parts can't be read back here
      body: text && !request.headers.get('Content-Type')?.startsWith('multipart/') ? JSON.parse(text) : undefined,
    }
    calls.push(call)
    const route = routes.findLast((r) => r.method === call.method && r.pattern.test(call.path))
    if (!route) {
      return problem(404, 'NOT_STUBBED', `${call.method} ${call.path}`)
    }
    const reply = await route.handler(call)
    return reply instanceof Response ? reply : json(200, reply)
  })
  globalThis.fetch = fetchMock as typeof fetch

  // A function answers each call; anything else is the answer to every call
  function on(method: string, path: string, reply: Handler): void
  function on(method: string, path: string, reply: Reply): void
  function on(method: string, path: string, reply: Handler | Reply) {
    const handler: Handler = typeof reply === 'function' ? (reply as Handler) : () => reply
    routes.push({ method, pattern: toPattern(path), handler })
  }

  return {
    fetch: fetchMock,
    calls,
    on,
    /** The calls to one method and path (placeholders allowed). */
    callsTo(method: string, path: string) {
      const pattern = toPattern(path)
      return calls.filter((c) => c.method === method && pattern.test(c.path))
    },
    reset() {
      routes.length = 0
      calls.length = 0
    },
  }
}

export type ApiStub = ReturnType<typeof stubApi>
