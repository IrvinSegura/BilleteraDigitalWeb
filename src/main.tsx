import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { ApiError } from '@/api/errors'
import { AuthProvider } from '@/auth/AuthProvider'
import { AppErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { isChunkLoadError, reloadForNewRelease } from '@/lib/chunk-reload'
import { initMonitoring } from '@/lib/monitoring'
import '@/i18n'

import { App } from './App'
import './index.css'

initMonitoring()

// A screen's chunk or CSS from the previous release failed to download; the import's own error then reaches a
// boundary only if the reload doesn't happen
window.addEventListener('vite:preloadError', (event) => {
  if (isChunkLoadError(event.payload) && reloadForNewRelease()) {
    event.preventDefault()
  }
})

// Keep in sync with the pre-paint script in index.html
const themeStorageKey = 'wallet.theme'

// The service worker keeps the app itself for offline use. Only in builds: in development it would serve stale
// modules over hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    // Hands the worker the files this load fetched before it was in control, so they are there offline
    void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({
      type: 'cache-assets',
      urls: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((name) => new URL(name).pathname.startsWith('/assets/')),
    }))
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (4xx) won't fix themselves; network and 5xx errors get one more try.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {/* The class is already on <html> from index.html; next-themes' own pre-paint script only runs with server
          rendering, so it is marked as data to stop React warning about it. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={themeStorageKey}
        scriptProps={{ type: 'application/json' }} disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster richColors position="top-center" />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
