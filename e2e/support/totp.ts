import { createHmac } from 'node:crypto'

const PERIOD_MS = 30_000
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32(secret: string): Buffer {
  let bits = ''
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char)
    if (value < 0) {
      throw new Error('Invalid base32 secret')
    }
    bits += value.toString(2).padStart(5, '0')
  }
  return Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)))
}

/** The 6-digit code an authenticator app shows for secret in the 30-second step of time (RFC 6238, SHA-1). */
export function totp(secret: string, time = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(time / PERIOD_MS)))
  const hash = createHmac('sha1', base32(secret)).update(counter).digest()
  const offset = hash[hash.length - 1]! & 0xf
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

// The API takes each code once: a second sign-in or step-up in the same 30 seconds needs the next one
const lastStep = new Map<string, number>()

/** A code the API hasn't seen yet for secret, waiting for the next step when this one was already used. */
export async function nextTotp(secret: string): Promise<string> {
  let step = Math.floor(Date.now() / PERIOD_MS)
  const last = lastStep.get(secret)
  if (last !== undefined && step <= last) {
    step = last + 1
    await new Promise((resolve) => setTimeout(resolve, step * PERIOD_MS - Date.now() + 250))
  }
  lastStep.set(secret, step)
  return totp(secret, step * PERIOD_MS)
}
