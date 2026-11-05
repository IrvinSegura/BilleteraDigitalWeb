import { describe, expect, it } from 'vitest'

import { formatClabe, isValidClabe } from './clabe'

// The usual published example: bank 032, branch 180, account 00011835971, check digit 9
const VALID = '032180000118359719'

describe('isValidClabe', () => {
  it('accepts a CLABE whose check digit matches', () => {
    expect(isValidClabe(VALID)).toBe(true)
    expect(isValidClabe('014027000005555558')).toBe(true)
  })

  it('refuses a wrong check digit', () => {
    expect(isValidClabe('032180000118359718')).toBe(false)
  })

  it('refuses a mistyped digit in the body', () => {
    expect(isValidClabe('032180000118369719')).toBe(false)
  })

  it('accepts a check digit of 0 (sum already a multiple of 10)', () => {
    const body = '00000000000000000'
    expect(isValidClabe(`${body}0`)).toBe(true)
  })

  it.each(['', '00218070188500017', '0021807018850001722', '00218070188500017a', '002 180 70188500017 2'])(
    'refuses %j, which is not 18 digits',
    (value) => {
      expect(isValidClabe(value)).toBe(false)
    },
  )
})

describe('formatClabe', () => {
  it('groups the digits 3-3-11-1', () => {
    expect(formatClabe(VALID)).toBe('032 180 00011835971 9')
  })

  it('formats a partial CLABE while it is typed', () => {
    expect(formatClabe('0021')).toBe('002 1')
    expect(formatClabe('002180')).toBe('002 180')
  })

  it('drops anything that is not a digit and stops at 18 digits', () => {
    expect(formatClabe('032-180 00011835971 9999')).toBe('032 180 00011835971 9')
  })
})
