import { describe, expect, it } from 'vitest'

import { changeBetween, lastDays, movedOn, operationsPerDay, sum, toSignupSeries, toVolumeSeries, totalsOf, usersToday } from './home-series'

const money = (amount: string, currency = 'MXN') => ({ amount, currency })

describe('the series of the admin home', () => {
  it('counts days as the API does, whatever the browser says', () => {
    // Already the 6th in UTC, still the 5th in Mexico
    expect(usersToday(new Date('2026-11-06T03:00:00Z'))).toBe('2026-11-05')
  })

  it('lists the days of the period, oldest first, across a month', () => {
    expect(lastDays(3, '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('fills the days with nothing and keeps one currency', () => {
    const series = toVolumeSeries([
      { date: '2026-11-02', kind: 'deposit', count: 2, amount: money('100.50') },
      { date: '2026-11-02', kind: 'transfer', count: 1, amount: money('50.00') },
      { date: '2026-11-02', kind: 'withdrawal', count: 9, amount: money('9.00', 'USD') },
      { date: '2020-01-01', kind: 'deposit', count: 1, amount: money('1.00') },
    ], ['2026-11-01', '2026-11-02'], 'MXN')

    expect(series).toEqual([
      { date: '2026-11-01', operations: 0, deposit: 0, transfer: 0, withdrawal: 0 },
      { date: '2026-11-02', operations: 3, deposit: 100.5, transfer: 50, withdrawal: 0 },
    ])
    expect(totalsOf(series)).toEqual({ deposit: 100.5, transfer: 50, withdrawal: 0 })
    expect(series.map(movedOn)).toEqual([0, 150.5])
  })

  it('fills the days nobody signed up', () => {
    expect(toSignupSeries([{ date: '2026-11-02', count: 4 }], ['2026-11-01', '2026-11-02'])).toEqual([
      { date: '2026-11-01', count: 0 },
      { date: '2026-11-02', count: 4 },
    ])
  })

  it('counts the operations of each day, of every kind and currency, only in the dates asked for', () => {
    const rows = [
      { date: '2026-11-02', count: 2 },
      { date: '2026-11-02', count: 3 },
      { date: '2026-10-30', count: 9 },
    ]

    expect(operationsPerDay(rows, ['2026-11-01', '2026-11-02'])).toEqual([0, 5])
    expect(sum(operationsPerDay(rows, ['2026-11-01', '2026-11-02']))).toBe(5)
  })

  it('compares a figure with the period before', () => {
    expect(changeBetween(150, 100)).toEqual({ trend: 'up', percent: 50 })
    expect(changeBetween(75, 100)).toEqual({ trend: 'down', percent: 25 })
    expect(changeBetween(100, 100)).toEqual({ trend: 'flat', percent: 0 })
    // Rounded to nothing, it's no change
    expect(changeBetween(1001, 1000)).toEqual({ trend: 'flat', percent: 0 })
  })

  it('has no percentage when the period before had nothing', () => {
    expect(changeBetween(5, 0)).toEqual({ trend: 'new', percent: 0 })
    expect(changeBetween(0, 0)).toEqual({ trend: 'flat', percent: 0 })
  })
})
