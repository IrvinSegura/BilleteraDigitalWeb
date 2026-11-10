// The same checks the API makes, so a typo is caught before uploading three photos. The API checks again.

const CURP = new RegExp('^[A-Z][AEIOUX][A-Z]{2}\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])'
  + '[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)'
  + '[B-DF-HJ-NP-TV-Z]{3}[A-Z\\d]\\d$')
const VOTER_KEY = /^[A-Z]{6}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(0[1-9]|[12]\d|3[0-2])[HMX]\d{3}$/
const CURP_ALPHABET = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

export const NAME = /^\p{L}[\p{L} .'-]{0,59}$/u
export const NINE_DIGITS = /^\d{9}$/
export const MAX_VALIDITY_YEARS = 10
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png']

/** A code as the card prints it: capitals, no spaces. */
export function normalizeCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** The CURP's shape and its last digit, which is computed from the other 17 characters. */
export function isValidCurp(curp: string): boolean {
  if (!CURP.test(curp)) {
    return false
  }
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += CURP_ALPHABET.indexOf(curp.charAt(i)) * (18 - i)
  }
  return Number(curp.charAt(17)) === (10 - (sum % 10)) % 10
}

export function isValidVoterKey(voterKey: string): boolean {
  return VOTER_KEY.test(voterKey)
}

/** Both codes come from the same birth record: same date (yyMMdd) and same sex. */
export function codesAgree(curp: string, voterKey: string): boolean {
  return voterKey.slice(6, 12) === curp.slice(4, 10) && voterKey.charAt(14) === curp.charAt(10)
}

export function isAcceptedPhoto(file: File): boolean {
  return PHOTO_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_PHOTO_BYTES
}
