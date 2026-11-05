import { afterEach, describe, expect, it, vi } from 'vitest'

import { amountOf, formatCalendarDay, formatMinor, formatMoney, formatRelative, initials, shortId } from './format'

// Intl separates the symbol with a non-breaking space in some locales; compare on plain spaces
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('formatMoney', () => {
  it('formats an API amount in its currency', () => {
    expect(plain(formatMoney({ amount: 1234.5 as never, currency: 'MXN' }))).toBe('$1,234.50')
  })

  it('keeps every cent of a large decimal string, without going through a float', () => {
    expect(formatMoney({ amount: '90071992547409.93' as never, currency: 'MXN' })).toBe('$90,071,992,547,409.93')
  })

  it('shows zero pesos when there is no amount', () => {
    expect(formatMoney(undefined)).toBe('$0.00')
  })
})

describe('formatMinor', () => {
  it('turns cents into the currency amount', () => {
    expect(formatMinor(123456, 'MXN')).toBe('$1,234.56')
    expect(formatMinor(-5)).toBe('-$0.05')
  })
})

describe('amountOf', () => {
  it('reads the amount as a number, zero when missing', () => {
    expect(amountOf({ amount: '10.25' as never, currency: 'MXN' })).toBe(10.25)
    expect(amountOf(undefined)).toBe(0)
  })
})

describe('formatCalendarDay', () => {
  it('shows the date the API sent, not the day before in zones behind UTC', () => {
    expect(formatCalendarDay('2026-11-01')).toBe('1 nov')
    expect(formatCalendarDay('2026-01-31')).toBe('31 ene')
  })
})

describe('formatRelative', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const now = new Date('2026-11-03T12:00:00Z')
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

  it('says how long ago something happened, up to a week', () => {
    vi.useFakeTimers({ now })
    expect(formatRelative(ago(10))).toBe('justo ahora')
    expect(formatRelative(ago(5 * 60))).toBe('hace 5 minutos')
    expect(formatRelative(ago(3 * 3600))).toBe('hace 3 horas')
    expect(formatRelative(ago(86400))).toBe('ayer')
  })

  it('falls back to the date after a week', () => {
    vi.useFakeTimers({ now })
    expect(formatRelative('2026-10-01T12:00:00Z')).toBe('1 oct 2026')
  })

  it('shows a dash when there is no date', () => {
    expect(formatRelative(undefined)).toBe('—')
  })
})

describe('initials', () => {
  it('takes the first letter of the first two names', () => {
    expect(initials('ana maría lópez')).toBe('AM')
    expect(initials('  Irvin  ')).toBe('I')
  })
})

describe('shortId', () => {
  it('keeps the first 8 characters of an id', () => {
    expect(shortId('3f689657-937e-4938-bf7f-5b2cdc4f5ae3')).toBe('3f689657')
    expect(shortId(undefined)).toBe('—')
  })
})
