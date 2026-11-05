import { afterEach, describe, expect, it } from 'vitest'

import { ApiError, errorMessage, storedCodeMessage } from '@/api/errors'
import { formatCalendarDay, formatDate, formatMoney, formatMonth } from '@/lib/format'
import { bankName, labelOf, movementLabel } from '@/lib/labels'

import i18n, { currentLanguage } from '.'

afterEach(async () => {
  await i18n.changeLanguage('es')
})

describe('the active language', () => {
  it('is Spanish by default', () => {
    expect(currentLanguage()).toBe('es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('reaches the page, for screen readers and browser translation', async () => {
    await i18n.changeLanguage('en')

    expect(currentLanguage()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('writes dates in its own language', async () => {
    expect(formatCalendarDay('2026-01-31')).toBe('31 ene')
    expect(formatMonth('2026-11')).toBe('noviembre de 2026')

    await i18n.changeLanguage('en')

    expect(formatCalendarDay('2026-01-31')).toBe('Jan 31')
    expect(formatMonth('2026-11')).toBe('November 2026')
    expect(formatDate('2026-10-15T12:00:00Z')).toBe('Oct 15, 2026')
  })

  it('leaves money as it is', async () => {
    await i18n.changeLanguage('en')

    expect(formatMoney({ amount: '1234.5' as never, currency: 'MXN' })).toBe('$1,234.50')
  })

  it('writes API errors in its own language, with the numbers the API gave', async () => {
    const limit = new ApiError(422, {
      code: 'DAILY_LIMIT_EXCEEDED',
      detail: 'Daily limit of $50,000.00 reached; you can still send $10.00',
    })

    expect(errorMessage(limit)).toBe('Alcanzaste tu límite diario de $50,000.00. Hoy aún puedes enviar $10.00.')

    await i18n.changeLanguage('en')

    expect(errorMessage(limit)).toContain('$50,000.00')
    expect(errorMessage(limit)).not.toContain('Alcanzaste')
    expect(errorMessage(new ApiError(404, {}))).toBe(i18n.t('errors.status.notFound'))
  })

  it('names what the API sends as codes, and shows a code it does not know as it comes', async () => {
    await i18n.changeLanguage('en')

    expect(movementLabel('TRANSFER', 'IN')).toBe(i18n.t('labels.movements.TRANSFER_IN'))
    expect(labelOf('labels.roles', 'ADMIN')).toBe('Administrator')
    expect(labelOf('labels.roles', 'AUDITOR')).toBe('AUDITOR')
    expect(bankName('999')).toBe('Bank 999')
    expect(storedCodeMessage('NOT_A_CODE')).toBeUndefined()
  })
})
