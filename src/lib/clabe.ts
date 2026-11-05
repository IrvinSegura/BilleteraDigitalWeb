const WEIGHTS = [3, 7, 1]

/** A CLABE is 18 digits whose last one is a check digit (weights 3, 7, 1 modulo 10); the API checks it again. */
export function isValidClabe(value: string): boolean {
  if (!/^\d{18}$/.test(value)) {
    return false
  }
  const sum = Array.from(value.slice(0, 17)).reduce((total, digit, i) => total + ((Number(digit) * WEIGHTS[i % 3]!) % 10), 0)
  return (10 - (sum % 10)) % 10 === Number(value[17])
}

/** Groups a CLABE as the banks print it: 3-3-11-1. */
export function formatClabe(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 18)
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 17), digits.slice(17)].filter(Boolean).join(' ')
}
