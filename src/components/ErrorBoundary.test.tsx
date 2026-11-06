import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/lib/monitoring'

import { AppErrorBoundary, PageErrorBoundary } from './ErrorBoundary'

vi.mock('@/lib/monitoring', () => ({ reportError: vi.fn() }))

let broken = true

function Fragile({ error = new Error('render failed') }: { error?: Error }) {
  if (broken) {
    throw error
  }
  return <p>Pantalla lista</p>
}

beforeEach(() => {
  broken = true
  vi.mocked(reportError).mockReset()
  // React logs every caught render error; the tests check what the user sees instead
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('AppErrorBoundary', () => {
  it('shows a crash screen instead of a blank page, and reports the error', () => {
    render(<AppErrorBoundary><Fragile /></AppErrorBoundary>)

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'render failed' }), { boundary: 'app', chunk: 'false' })
  })

  it('renders the app again on retry', async () => {
    render(<AppErrorBoundary><Fragile /></AppErrorBoundary>)
    broken = false

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(screen.getByText('Pantalla lista')).toBeInTheDocument()
  })

  it('offers a reload when a screen of the previous release is gone', () => {
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() })
    sessionStorage.setItem('wallet.chunkReloadedAt', String(Date.now()))

    render(<AppErrorBoundary><Fragile error={new TypeError('Failed to fetch dynamically imported module: /assets/x.js')} /></AppErrorBoundary>)

    expect(screen.getByRole('heading', { name: 'Hay una nueva versión disponible' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  it('reloads by itself the first time a screen chunk is missing, without reporting it', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    render(<AppErrorBoundary><Fragile error={new TypeError('Importing a module script failed.')} /></AppErrorBoundary>)

    expect(reload).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })
})

describe('PageErrorBoundary', () => {
  function Shell() {
    return (
      <>
        <nav><Link to="/">Inicio</Link> <Link to="/wallets">Billeteras</Link></nav>
        <PageErrorBoundary>
          <Routes>
            <Route path="/" element={<p>Inicio listo</p>} />
            <Route path="/wallets" element={<Fragile />} />
          </Routes>
        </PageErrorBoundary>
      </>
    )
  }

  it('keeps the navigation working and clears the error on another page', async () => {
    render(<MemoryRouter initialEntries={['/wallets']}><Shell /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledWith(expect.anything(), { boundary: 'page', chunk: 'false' })

    await userEvent.click(screen.getByRole('link', { name: 'Inicio' }))

    expect(screen.getByText('Inicio listo')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Algo salió mal' })).not.toBeInTheDocument()
  })

  it('offers a way home from a broken page', () => {
    render(<MemoryRouter initialEntries={['/wallets']}><Shell /></MemoryRouter>)

    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })
})
