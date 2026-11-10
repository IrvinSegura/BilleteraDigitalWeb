import { describe, expect, it } from 'vitest'

import { codesAgree, isAcceptedPhoto, isValidCurp, isValidVoterKey, normalizeCode } from './ine'

// Juan Gómez Martínez, born 15 May 1990 in Mexico City; its last digit is computed from the other 17
const CURP = 'GOMJ900515HDFMRB02'
const VOTER_KEY = 'GMMRJN90051509H123'

describe('isValidCurp', () => {
  it('accepts a CURP whose check digit matches', () => {
    expect(isValidCurp(CURP)).toBe(true)
  })

  it('refuses a wrong check digit, a wrong shape or an impossible date', () => {
    expect(isValidCurp('GOMJ900515HDFMRB03')).toBe(false)
    expect(isValidCurp('GOMJ900515HZZMRB02')).toBe(false)
    expect(isValidCurp('GOMJ901315HDFMRB02')).toBe(false)
    expect(isValidCurp('GOMJ900515HDFMR')).toBe(false)
  })
})

describe('isValidVoterKey', () => {
  it('accepts six letters, the birth date, the state, the sex and three digits', () => {
    expect(isValidVoterKey(VOTER_KEY)).toBe(true)
  })

  it('refuses anything else', () => {
    expect(isValidVoterKey('GMMRJN90051509H12')).toBe(false)
    expect(isValidVoterKey('GMMRJN90051533H123')).toBe(false)
    expect(isValidVoterKey('GMMRJ190051509H123')).toBe(false)
  })
})

describe('codesAgree', () => {
  it('needs the same birth date and sex in both codes', () => {
    expect(codesAgree(CURP, VOTER_KEY)).toBe(true)
    expect(codesAgree(CURP, 'GMMRJN90051609H123')).toBe(false)
    expect(codesAgree(CURP, 'GMMRJN90051509M123')).toBe(false)
  })
})

describe('normalizeCode', () => {
  it('writes a code as the card prints it', () => {
    expect(normalizeCode(' gomj 900515hdfmrb02 ')).toBe(CURP)
  })
})

describe('isAcceptedPhoto', () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'photo', { type })

  it('takes JPG and PNG up to 8 MB', () => {
    expect(isAcceptedPhoto(file('image/jpeg', 1024))).toBe(true)
    expect(isAcceptedPhoto(file('image/png', 8 * 1024 * 1024))).toBe(true)
  })

  it('refuses other types, empty files and larger ones', () => {
    expect(isAcceptedPhoto(file('image/gif', 1024))).toBe(false)
    expect(isAcceptedPhoto(file('image/jpeg', 0))).toBe(false)
    expect(isAcceptedPhoto(file('image/jpeg', 8 * 1024 * 1024 + 1))).toBe(false)
  })
})
