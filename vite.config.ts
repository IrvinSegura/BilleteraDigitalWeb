/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { securityHeadersPlugin } from './security-headers.ts'

export default defineConfig(({ mode }) => {
  // Where the dev server forwards /api; the browser only sees this app's own origin, so the API needs no CORS
  // and its SameSite=Strict refresh cookie is sent as first-party.
  const apiTarget = loadEnv(mode, process.cwd(), 'API_').API_PROXY_TARGET || 'http://localhost:8080'
  const proxy = { '/api': { target: apiTarget, changeOrigin: true } }
  // An API on another origin and the error monitoring ingest must be allowed by the CSP's connect-src. A Sentry
  // DSN is https://<key>@<ingest host>/<project>: its origin is where reports are sent.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const connectOrigins = [env.VITE_API_URL, env.VITE_SENTRY_DSN].filter(Boolean).map((url) => new URL(url!).origin)
  return {
    plugins: [react(), tailwindcss(), securityHeadersPlugin(connectOrigins, { turnstile: Boolean(env.VITE_TURNSTILE_SITE_KEY) })],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // The API's wallet.notifications.email.app-url and payments.return-url point here in development
      port: 3000,
      strictPort: true,
      proxy,
    },
    // `npm run build && npm run preview`: the production build with its security headers, on the same API
    preview: {
      port: 4173,
      proxy,
    },
    build: {
      rolldownOptions: {
        output: {
          // React in its own long-lived chunk, so app releases don't invalidate it; other libraries stay with the
          // screens that use them (charts, QR codes), loaded only when those screens open
          codeSplitting: {
            groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ }],
          },
        },
      },
    },
    // `npm test`: unit and component tests in a simulated browser. The API base URL is absolute there because
    // Node's fetch can't resolve the relative URLs the browser does.
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', '*.test.ts'],
      setupFiles: ['src/test/setup.ts'],
      env: { VITE_API_URL: 'http://localhost:3000' },
      restoreMocks: true,
      unstubGlobals: true,
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/api/schema.d.ts', 'src/components/ui/**', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      },
    },
  }
})
