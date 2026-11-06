import { describe, expect, it } from 'vitest'

import { ApiError, errorMessage, hasCode, isPasswordRejected, moneyErrorMessage, RequestTimeoutError } from './errors'

describe('ApiError', () => {
  it('carries the code, correlation id and validation messages by field', () => {
    const error = new ApiError(400, {
      detail: 'Validation failed',
      code: 'VALIDATION_FAILED',
      correlationId: 'abc-123',
      violations: [{ field: 'amount', message: 'must be greater than 0' }],
    })
    expect(error.status).toBe(400)
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(error.correlationId).toBe('abc-123')
    expect(error.fieldErrors).toEqual({ amount: 'must be greater than 0' })
    expect(hasCode(error, 'VALIDATION_FAILED')).toBe(true)
    expect(hasCode(new Error('x'), 'VALIDATION_FAILED')).toBe(false)
  })

  it('has a message even without a ProblemDetail', () => {
    expect(new ApiError(502, undefined).message).toBe('La solicitud falló (502)')
  })

  it('tells a refused new password apart from other errors', () => {
    expect(isPasswordRejected(new ApiError(422, { code: 'WEAK_PASSWORD' }))).toBe(true)
    expect(isPasswordRejected(new ApiError(422, { code: 'COMMON_PASSWORD' }))).toBe(true)
    expect(isPasswordRejected(new ApiError(422, { code: 'BREACHED_PASSWORD' }))).toBe(true)
    expect(isPasswordRejected(new ApiError(422, { code: 'INCORRECT_PASSWORD' }))).toBe(false)
  })
})

describe('errorMessage', () => {
  it('translates a known code', () => {
    expect(errorMessage(new ApiError(422, { code: 'INSUFFICIENT_FUNDS' }))).toBe('No tienes saldo suficiente.')
  })

  it('builds the daily limit message from the numbers in the detail', () => {
    const error = new ApiError(422, {
      code: 'DAILY_LIMIT_EXCEEDED',
      detail: 'Daily transfer limit of $10,000.00 reached; you can still send $250.00',
    })
    expect(errorMessage(error)).toBe('Alcanzaste tu límite diario de $10,000.00. Hoy aún puedes enviar $250.00.')
  })

  it('has a generic daily limit message when the detail changes shape', () => {
    expect(errorMessage(new ApiError(422, { code: 'DAILY_LIMIT_EXCEEDED', detail: 'Limit hit' })))
      .toBe('Alcanzaste tu límite diario de envíos.')
  })

  it('names the currency of a recipient without a wallet in it', () => {
    const error = new ApiError(404, { code: 'RECIPIENT_NOT_FOUND', detail: 'No user with a USD wallet' })
    expect(errorMessage(error)).toBe('No encontramos a nadie con ese correo y una billetera en USD.')
  })

  it('falls back to the status for an unknown code', () => {
    expect(errorMessage(new ApiError(403, { code: 'SOMETHING_NEW' }))).toBe('No tienes permiso para hacer esto.')
    expect(errorMessage(new ApiError(418, undefined))).toBe('Algo salió mal.')
  })

  it('hides server errors behind one message, except a provider being down', () => {
    expect(errorMessage(new ApiError(500, { code: 'INSUFFICIENT_FUNDS' })))
      .toBe('El servidor tuvo un problema; inténtalo más tarde.')
    expect(errorMessage(new ApiError(503, { code: 'PAYMENT_PROVIDER_UNAVAILABLE' })))
      .toBe('El proveedor de pagos no está disponible; inténtalo más tarde.')
  })

  it('tells a network failure apart from an API error', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe('No se pudo conectar con el servidor. Revisa tu conexión.')
    expect(errorMessage('boom')).toBe('Algo salió mal.')
  })

  it('says when the API took too long', () => {
    expect(errorMessage(new RequestTimeoutError())).toBe('El servidor tardó demasiado en responder. Inténtalo de nuevo.')
  })

  it('warns that money may have moved only when no answer came', () => {
    const unknown = /no sabemos si se completó/
    expect(moneyErrorMessage(new RequestTimeoutError())).toMatch(unknown)
    expect(moneyErrorMessage(new TypeError('Failed to fetch'))).toMatch(unknown)
    expect(moneyErrorMessage(new ApiError(503, undefined))).not.toMatch(unknown)
    expect(moneyErrorMessage(new ApiError(422, { code: 'INSUFFICIENT_FUNDS' }))).not.toMatch(unknown)
  })
})
