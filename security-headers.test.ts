// @vitest-environment node
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { securityHeaders } from './security-headers.ts'

const inline = "document.documentElement.classList.add('dark')"
const html = `<html><head>
  <script>${inline}</script>
  <script type="application/json">{"theme":"dark"}</script>
  <script type="module" src="/assets/index-abc.js"></script>
</head></html>`

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `))

describe('securityHeaders', () => {
  it('allows only the hash of the inline script, not data blocks or bundles', () => {
    const csp = securityHeaders(html)['Content-Security-Policy']!
    const hash = createHash('sha256').update(inline).digest('base64')

    expect(directive(csp, 'script-src')).toBe(`script-src 'self' 'sha256-${hash}'`)
    expect(directive(csp, 'script-src')).not.toContain('unsafe')
  })

  it('lets the app reach only its own origin, plus the API and error monitoring when they live elsewhere', () => {
    expect(directive(securityHeaders(html)['Content-Security-Policy']!, 'connect-src')).toBe("connect-src 'self'")
    const csp = securityHeaders(html, ['https://api.example.com', 'https://o1.ingest.sentry.io'])['Content-Security-Policy']!
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https://api.example.com https://o1.ingest.sentry.io")
  })

  it('allows Cloudflare Turnstile only when the app uses it', () => {
    const without = securityHeaders(html)['Content-Security-Policy']!
    expect(without).not.toContain('challenges.cloudflare.com')
    expect(directive(without, 'frame-src')).toBeUndefined()

    const csp = securityHeaders(html, [], { turnstile: true })['Content-Security-Policy']!
    expect(directive(csp, 'script-src')).toMatch(/ https:\/\/challenges\.cloudflare\.com$/)
    expect(directive(csp, 'frame-src')).toBe('frame-src https://challenges.cloudflare.com')
  })

  it('forbids framing, sniffing and plain http', () => {
    const headers = securityHeaders(html)
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d{8,}/)
  })
})
