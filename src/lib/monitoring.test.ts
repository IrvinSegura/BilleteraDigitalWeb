import type { ErrorEvent } from '@sentry/react'
import { describe, expect, it } from 'vitest'

import { scrubBreadcrumb, scrubEvent, stripUrl } from './monitoring'

describe('stripUrl', () => {
  it('drops the query and the fragment', () => {
    expect(stripUrl('https://app.example.com/reset-password#token=secret')).toBe('https://app.example.com/reset-password')
    expect(stripUrl('/api/v1/admin/users/search?q=ana@example.com&page=0')).toBe('/api/v1/admin/users/search')
    expect(stripUrl('/wallets/123')).toBe('/wallets/123')
  })
})

describe('scrubEvent', () => {
  it('keeps only the page and the browser, never the user, cookies or query', () => {
    const event = {
      type: undefined,
      user: { id: 'u1', email: 'ana@example.com', ip_address: '1.2.3.4' },
      request: {
        url: 'https://app.example.com/verify-email#token=secret',
        query_string: 'token=secret',
        cookies: { refresh: 'abc' },
        headers: { 'User-Agent': 'Firefox', Referer: 'https://app.example.com/?q=ana@example.com', Authorization: 'Bearer x' },
      },
    } as ErrorEvent

    const scrubbed = scrubEvent(event)

    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.request).toEqual({ url: 'https://app.example.com/verify-email', headers: { 'User-Agent': 'Firefox' } })
  })

  it('leaves an event without a request alone', () => {
    const event = { type: undefined, message: 'boom' } as ErrorEvent
    expect(scrubEvent(event)).toEqual({ type: undefined, message: 'boom' })
  })
})

describe('scrubBreadcrumb', () => {
  it('drops console output', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'user ana@example.com' })).toBeNull()
  })

  it('strips queries and fragments from requests and navigations', () => {
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: '/api/v1/admin/users/search?q=ana', status_code: 200 } }))
      .toEqual({ category: 'fetch', data: { url: '/api/v1/admin/users/search', status_code: 200 } })
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/login?next=/', to: '/reset-password#token=secret' } }))
      .toEqual({ category: 'navigation', data: { from: '/login', to: '/reset-password' } })
  })
})
