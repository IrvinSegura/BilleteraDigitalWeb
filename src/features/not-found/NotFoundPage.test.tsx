import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('says the address does not exist and offers the way home', () => {
    renderWithProviders(<NotFoundPage />, { route: '/no-existe' })

    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })
})
