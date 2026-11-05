import i18n, { type MessageKey } from '@/i18n'

/**
 * Strength meter for new passwords, mirroring the API's rules (NIST SP 800-63B: length, not composition) so the bars
 * never praise a password the API will refuse. The API keeps the full list of common passwords; this one only has the
 * words people try first, so a password can still pass here and be refused there.
 */

export const MIN_PASSWORD_LENGTH = 12

export type PasswordStrength = {
  /** 1 to 5 bars; 1 when the password is too short or easy to guess */
  score: number
  label: string
  easyToGuess: boolean
}

const COMMON = new Set([
  'password', 'passw', 'passwd', 'pass', 'contrasena', 'contra', 'clave', 'miclave', 'secreto', 'secret', 'admin',
  'administrador', 'administrator', 'root', 'user', 'usuario', 'login', 'acceso', 'access', 'test', 'prueba', 'demo',
  'default', 'changeme', 'cambiame', 'welcome', 'bienvenido', 'bienvenida', 'letmein', 'master', 'guest', 'invitado',
  'qwerty', 'azerty', 'abc', 'abcd', 'asdf', 'billetera', 'billeteradigital', 'wallet', 'digitalwallet', 'mibilletera',
  'mywallet', 'dinero', 'money', 'banco', 'bank', 'cartera', 'monedero', 'pago', 'pagos', 'payment', 'iloveyou',
  'iloveu', 'loveyou', 'teamo', 'tequiero', 'amor', 'amormio', 'miamor', 'mivida', 'corazon', 'love', 'princesa',
  'princess', 'angel', 'bonita', 'hermosa', 'bebe', 'baby', 'sunshine', 'whatever', 'nada', 'mexico', 'vivamexico',
  'america', 'chivas', 'pumas', 'tigres', 'rayados', 'cruzazul', 'futbol', 'football', 'soccer', 'pokemon', 'superman',
  'batman', 'spiderman', 'dragon', 'dragonball', 'monkey', 'shadow', 'hello', 'hola', 'holamundo', 'helloworld',
  'google', 'facebook', 'instagram', 'whatsapp', 'iphone', 'samsung', 'android', 'computadora', 'internet', 'matrix',
])

// Doubled, so a walk may wrap around ("7890123456"), and reversed, so it may go either way
const WALKS = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm',
  '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p', '1q2w3e4r5t6y7u8i9o0p', 'qazwsxedcrfvtgbyhnujmikolp',
  'zaq1xsw2cde3vfr4bgt5nhy6mju7ki8lo9p0']
  .map((walk) => walk + walk)
  .flatMap((walk) => [walk, [...walk].reverse().join('')])

const LEET: Record<string, string> = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', $: 's', '5': 's', '7': 't' }

const MIN_DISTINCT = 5
const MIN_WALK_LENGTH = 6
const MIN_PERSONAL_LENGTH = 4

const LABELS: MessageKey[] = [
  'passwordStrength.tooShort',
  'passwordStrength.tooShort',
  'passwordStrength.acceptable',
  'passwordStrength.good',
  'passwordStrength.strong',
  'passwordStrength.excellent',
]

/**
 * @param personal what the password must not be built from: the user's email and name
 */
export function passwordStrength(password: string, personal: readonly (string | undefined)[] = []): PasswordStrength {
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    return { score: 1, label: i18n.t('passwordStrength.tooShort'), easyToGuess: false }
  }
  if (isEasyToGuess(normalize(password), personalWords(personal))) {
    return { score: 1, label: i18n.t('passwordStrength.easyToGuess'), easyToGuess: true }
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  const score = Math.min(5, 2 + (password.length >= 16 ? 1 : 0) + Math.max(0, classes - 1))
  return { score, label: i18n.t(LABELS[score]!), easyToGuess: false }
}

function isEasyToGuess(password: string, personal: Set<string>): boolean {
  if (new Set(password).size < MIN_DISTINCT) {
    return true
  }
  // Spaces and symbols don't make "1234 5678 9012" or "qwerty-uiop-as" any harder to guess
  const compact = password.replace(/[^\p{L}\p{N}]/gu, '')
  if (COMMON.has(compact) || unitOf(compact) !== compact || isWalk(compact)) {
    return true
  }
  const unit = unitOf(core(password))
  return COMMON.has(unit) || personal.has(unit)
}

// The word inside the digits and symbols added to meet composition rules: "P@ssw0rd2024!" is "password"
function core(password: string): string {
  const letterLike = (c: string) => /\p{L}/u.test(c) || c === '@'
  const chars = [...password]
  let start = 0
  let end = chars.length
  while (start < end && !letterLike(chars[start])) start++
  while (end > start && !letterLike(chars[end - 1])) end--
  return chars.slice(start, end).map((c) => LEET[c] ?? c).filter((c) => /\p{L}/u.test(c)).join('')
}

// The shortest piece the text repeats: "abcabcabc" gives "abc"
function unitOf(text: string): string {
  return text === '' ? text : text.slice(0, (text + text).indexOf(text, 1))
}

function isWalk(text: string): boolean {
  return text.length >= MIN_WALK_LENGTH && WALKS.some((walk) => walk.includes(text))
}

// "Ana López" gives "analopez" and "lopez"; "ana.lopez90@mail.com" gives "analopez" too
function personalWords(personal: readonly (string | undefined)[]): Set<string> {
  const words = new Set<string>()
  for (const value of personal) {
    if (!value) continue
    const normalized = normalize(value)
    const text = normalized.includes('@') ? normalized.slice(0, normalized.indexOf('@')) : normalized
    words.add(text.replace(/\P{L}/gu, ''))
    text.split(/\P{L}+/u).forEach((word) => words.add(word))
  }
  return new Set([...words].filter((word) => word.length >= MIN_PERSONAL_LENGTH))
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
