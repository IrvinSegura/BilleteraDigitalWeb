import { describe, expect, it } from 'vitest'

import { isFlatAtZero, toSeries } from './balance-series'

const mxn = (amount: string) => ({ amount: amount as never, currency: 'MXN' })

describe('toSeries', () => {
  it('starts the day before the first point with the balance the period opened with', () => {
    const series = toSeries({
      openingBalance: mxn('10.00'),
      points: [
        { date: '2026-11-01', balance: mxn('10.00') },
        { date: '2026-11-02', balance: mxn('35.50') },
      ],
    })

    expect(series.map((p) => [p.date, p.balance])).toEqual([
      ['2026-10-31', 10],
      ['2026-11-01', 10],
      ['2026-11-02', 35.5],
    ])
  })

  it('draws a line for a wallet opened today, from zero to its balance', () => {
    const series = toSeries({ openingBalance: mxn('0.00'), points: [{ date: '2026-03-01', balance: mxn('75.00') }] })

    expect(series.map((p) => p.date)).toEqual(['2026-02-28', '2026-03-01'])
    expect(isFlatAtZero(series)).toBe(false)
  })

  it('keeps the exact amount for labels', () => {
    const series = toSeries({ openingBalance: mxn('0.00'), points: [{ date: '2026-11-03', balance: mxn('90071992547409.93') }] })

    expect(series[1]!.money?.amount).toBe('90071992547409.93')
  })

  it('has nothing to draw without points or money', () => {
    expect(toSeries(undefined)).toEqual([])
    expect(isFlatAtZero(toSeries({ openingBalance: mxn('0.00'), points: [{ date: '2026-11-03', balance: mxn('0.00') }] })))
      .toBe(true)
  })
})
