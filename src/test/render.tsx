import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

import { Dialog, DialogContent } from '@/components/ui/dialog'

// Where the app is, for tests that check a navigation
function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location" hidden>{location.pathname + location.search}</output>
}

/** The current path and query of a screen rendered with renderWithProviders. */
export const currentLocation = () => document.querySelector('[data-testid="location"]')?.textContent

export interface RenderOptions {
  route?: string
  path?: string
  /** Query data already in the cache, as when the screen opens after others loaded it: [query key, data] pairs. */
  cached?: [readonly unknown[], unknown][]
}

/**
 * Renders a screen with a fresh query client (no retries) inside a router at `route`. With `path` (e.g.
 * "/wallets/:walletId") the screen is mounted on that route so it can read its params.
 */
export function renderWithProviders(ui: ReactNode, { route = '/', path, cached = [] }: RenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  for (const [key, data] of cached) {
    client.setQueryData(key, data)
  }
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        {path ? <Routes><Route path={path} element={ui} /><Route path="*" element={null} /></Routes> : ui}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...result }
}

/** Renders a money dialog's content the way MoneyActionsProvider does: inside an open dialog. */
export function renderDialog(content: ReactNode, options?: RenderOptions) {
  return renderWithProviders(<Dialog open><DialogContent>{content}</DialogContent></Dialog>, options)
}
