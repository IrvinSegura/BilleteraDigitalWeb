import { describe, expect, it } from 'vitest'

import { lastThreeMonths } from './PeriodPicker'
import { daysIn, firstRecordDay, monthOf, monthPeriod, periodFromParams, periodSlug, periodToParams } from './statement-data'

const TODAY = '2026-11-06'
const FIRST = '2026-01-15'
const november = monthPeriod('2026-11')
const params = (query: string) => new URLSearchParams(query)

describe('periods', () => {
  it('knows a whole calendar month from any other run of days', () => {
    expect(monthPeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthOf({ from: '2026-02-01', to: '2026-02-28' })).toBe('2026-02')
    expect(monthOf({ from: '2026-02-01', to: '2026-02-27' })).toBeUndefined()
    expect(daysIn({ from: '2026-01-01', to: '2026-12-31' })).toBe(365)
  })

  it('names a month by itself and other periods by both ends', () => {
    expect(periodToParams(monthPeriod('2026-10'))).toEqual({ month: '2026-10' })
    expect(periodToParams({ from: '2026-10-10', to: '2026-10-20' })).toEqual({ from: '2026-10-10', to: '2026-10-20' })
    expect(periodSlug({ from: '2026-10-10', to: '2026-10-20' })).toBe('2026-10-10_2026-10-20')
  })

  it('puts the last three months together, never before the first record', () => {
    expect(lastThreeMonths(TODAY, FIRST)).toEqual({ from: '2026-09-01', to: TODAY })
    expect(lastThreeMonths(TODAY, '2026-10-12')).toEqual({ from: '2026-10-12', to: TODAY })
  })
})

describe('periodFromParams', () => {
  it('reads a month or a pair of days', () => {
    expect(periodFromParams(params('month=2026-10'), november, FIRST, TODAY)).toEqual(monthPeriod('2026-10'))
    expect(periodFromParams(params('from=2026-10-10&to=2026-10-20'), november, FIRST, TODAY))
      .toEqual({ from: '2026-10-10', to: '2026-10-20' })
  })

  it('keeps days picked by hand within the user\'s history', () => {
    expect(periodFromParams(params('from=2026-01-01&to=2026-12-31'), november, FIRST, TODAY)).toEqual({ from: FIRST, to: TODAY })
  })

  it.each([
    ['nothing', ''],
    ['a malformed month', 'month=2026-13'],
    ['reversed days', 'from=2026-10-20&to=2026-10-10'],
    ['more than a statement holds', 'from=2025-01-01&to=2026-10-01'],
    ['the future', 'month=2026-12'],
    ['days before the first record', 'from=2025-12-01&to=2025-12-31'],
    ['only one end', 'from=2026-10-10'],
  ])('falls back for %s', (_, query) => {
    expect(periodFromParams(params(query), november, FIRST, TODAY)).toEqual(november)
  })
})

describe('firstRecordDay', () => {
  it('is the day the oldest wallet opened, or the account was created without one', () => {
    const wallets = [{ createdAt: '2026-03-01T12:00:00Z' }, { createdAt: '2026-02-01T12:00:00Z' }]
    expect(firstRecordDay(wallets, '2026-01-01T12:00:00Z')).toBe('2026-02-01')
    expect(firstRecordDay([], '2026-01-01T12:00:00Z')).toBe('2026-01-01')
    expect(firstRecordDay([], undefined)).toBeUndefined()
  })
})
