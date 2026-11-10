import { randomInt } from 'node:crypto'
import { crc32, deflateSync } from 'node:zlib'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const VOWELS = 'AEIOU'
const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'
const CURP_ALPHABET = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

const pick = (from: string) => from.charAt(randomInt(from.length))
const pad = (value: number, length = 2) => String(value).padStart(length, '0')
const digits = (length: number) => Array.from({ length }, () => randomInt(10)).join('')

/**
 * The data of a voter card no account has used: the API takes each CURP and voter key once, so every run needs new
 * ones. Both are valid (shape and the CURP's check digit) and agree with each other (birth date and sex), as the API
 * checks; the person is an adult born in the 1980s or 90s.
 */
export function newIneData() {
  const birth = `${pad(randomInt(80, 100))}${pad(randomInt(1, 13))}${pad(randomInt(1, 29))}`
  const stem = `${pick(LETTERS)}${pick(VOWELS)}${pick(LETTERS)}${pick(LETTERS)}${birth}HDF`
    + `${pick(CONSONANTS)}${pick(CONSONANTS)}${pick(CONSONANTS)}0`
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += CURP_ALPHABET.indexOf(stem.charAt(i)) * (18 - i)
  }
  const curp = stem + String((10 - (sum % 10)) % 10)
  const voterKey = `${Array.from({ length: 6 }, () => pick(LETTERS)).join('')}${birth}${pad(randomInt(1, 33))}H${digits(3)}`
  return {
    curp,
    voterKey,
    cic: digits(9),
    citizenId: digits(9),
    expiryYear: String(new Date().getFullYear() + 5),
  }
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * A plain PNG photo for the upload fields. The API decodes every picture and refuses one whose shorter side is under
 * 400 pixels, so a card would be readable; this one is 640 × 420, in one color.
 */
export function pngPhoto(name: string, [red, green, blue]: [number, number, number] = [40, 90, 160]) {
  const width = 640
  const height = 420
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  // 8 bits per channel, RGB, no interlacing
  header.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) {
    row.set([red, green, blue], 1 + x * 3)
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row))
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return { name, mimeType: 'image/png', buffer }
}
