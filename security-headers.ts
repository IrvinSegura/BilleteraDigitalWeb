import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Plugin } from 'vite'

/** sha256 CSP sources for the page's inline scripts, so they run while any injected one is blocked. */
function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => `'sha256-${createHash('sha256').update(body!).digest('base64')}'`)
}

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

export interface SecurityHeaderOptions {
  /** The sign-up and password reset forms load Cloudflare Turnstile (VITE_TURNSTILE_SITE_KEY set). */
  turnstile?: boolean
}

/**
 * The headers production must send with the app. connectOrigins are the other origins the page calls: the API
 * when it isn't this app's own (VITE_API_URL set) and the error monitoring ingest (VITE_SENTRY_DSN set). The
 * payment provider is only navigated to, which connect-src doesn't cover.
 */
export function securityHeaders(html: string, connectOrigins: string[] = [], { turnstile = false }: SecurityHeaderOptions = {}): Record<string, string> {
  const csp = [
    "default-src 'self'",
    ["script-src 'self'", ...inlineScriptHashes(html), ...(turnstile ? [TURNSTILE_ORIGIN] : [])].join(' '),
    // Turnstile's challenge runs in its own frame; nothing else may be framed
    ...(turnstile ? [`frame-src ${TURNSTILE_ORIGIN}`] : []),
    // Sonner and the UI primitives inject small style tags; inline styles can't run code
    "style-src 'self' 'unsafe-inline'",
    // data: for the two-factor QR code, blob: for the recovery codes download
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ["connect-src 'self'", ...connectOrigins].join(' '),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    // Nobody may frame the app: clicks can't be hijacked by an invisible overlay
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
}

/**
 * Writes the production headers next to the build (dist/_headers for Netlify and Cloudflare Pages,
 * dist/nginx-security-headers.conf for nginx) and sends them from `vite preview`, so production can be tried
 * locally. The dev server doesn't get them: Vite's hot reload needs inline scripts.
 */
export function securityHeadersPlugin(connectOrigins: string[] = [], options: SecurityHeaderOptions = {}): Plugin {
  let outDir = 'dist'
  const headersFor = () => securityHeaders(readFileSync(join(outDir, 'index.html'), 'utf8'), connectOrigins, options)
  return {
    name: 'wallet-security-headers',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      const headers = headersFor()
      const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)
      writeFileSync(join(outDir, '_headers'), [
        '/*', ...lines,
        // File names carry a content hash, so they can be cached for good; the page must always be revalidated
        '/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
        '/index.html', '  Cache-Control: no-cache',
        // A new service worker must reach the browser as soon as it is released
        '/sw.js', '  Cache-Control: no-cache',
        '',
      ].join('\n'))
      writeFileSync(join(outDir, 'nginx-security-headers.conf'),
        Object.entries(headers).map(([name, value]) => `add_header ${name} "${value}" always;`).join('\n') + '\n')
    },
    configurePreviewServer(server) {
      // Preview runs on plain http://localhost: HSTS and upgrading requests to https would only break it there
      const local: Record<string, (value: string) => string> = {
        'Strict-Transport-Security': () => 'max-age=0',
        'Content-Security-Policy': (value) => value.replace('; upgrade-insecure-requests', ''),
      }
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headersFor())) {
          res.setHeader(name, local[name]?.(value) ?? value)
        }
        next()
      })
    },
  }
}
