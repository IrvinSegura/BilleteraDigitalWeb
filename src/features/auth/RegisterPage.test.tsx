import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { json, problem, stubApi } from '@/test/api'
import { renderWithProviders } from '@/test/render'

const api = stubApi()

const { RegisterPage } = await import('./RegisterPage')

async function register({ name = 'Ana López', email = 'ana@example.com', password = 'una frase larga y segura' } = {}) {
  if (name) await userEvent.type(screen.getByLabelText('Nombre completo'), name)
  if (email) await userEvent.type(screen.getByLabelText('Correo electrónico'), email)
  if (password) await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('RegisterPage', () => {
  beforeEach(() => {
    api.reset()
    api.on('POST', '/api/v1/auth/register', json(202))
  })

  it('creates the account and says where the link went', async () => {
    renderWithProviders(<RegisterPage />)
    await register()
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(api.callsTo('POST', '/api/v1/auth/register')[0]!.body)
      .toEqual({ fullName: 'Ana López', email: 'ana@example.com', password: 'una frase larga y segura' })
  })

  it('applies the API bounds before sending', async () => {
    renderWithProviders(<RegisterPage />)
    await register({ name: 'A', email: 'no-es-correo', password: 'corta' })
    expect(await screen.findByText('Escribe tu nombre completo')).toBeInTheDocument()
    expect(screen.getByText('Escribe un correo válido')).toBeInTheDocument()
    expect(screen.getByText('Usa al menos 12 caracteres')).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
  })

  it('refuses markup in the name', async () => {
    renderWithProviders(<RegisterPage />)
    await register({ name: '<b>Ana</b>' })
    expect(await screen.findByText('No uses los caracteres < ni >.')).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
  })

  it('puts a leaked password refusal under the password field', async () => {
    api.on('POST', '/api/v1/auth/register', problem(400, 'BREACHED_PASSWORD'))
    renderWithProviders(<RegisterPage />)
    await register()
    expect(await screen.findByText(/apareció en una filtración/)).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
  })

  it('marks the fields the API found invalid', async () => {
    api.on('POST', '/api/v1/auth/register', json(400, {
      status: 400, code: 'VALIDATION_FAILED', detail: 'Invalid', violations: [{ field: 'email', message: 'must be valid' }],
    }))
    renderWithProviders(<RegisterPage />)
    await register()
    expect(await screen.findByText('Revisa este campo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the strength of the password as it is typed', async () => {
    renderWithProviders(<RegisterPage />)
    await userEvent.type(screen.getByLabelText('Contraseña'), 'abc')
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })
})
