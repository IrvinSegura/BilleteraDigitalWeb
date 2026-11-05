import { describe, expect, it } from 'vitest'

import { passwordStrength } from './password-strength'

describe('passwordStrength', () => {
  it('calls anything under 12 characters too short', () => {
    expect(passwordStrength('Abc!9xyz')).toMatchObject({ score: 1, label: 'Muy corta', easyToGuess: false })
  })

  it.each([
    'P@ssw0rd2024!',
    'Contraseña123!',
    'teamoteamoteamo',
    'aaaaaaaaaaaaaa',
    '121212121212',
    '1234567890123',
    'Qwerty123456',
    'Qwerty-Uiop-As',
    '1q2w3e4r5t6y',
    'Billetera2026$',
  ])('flags %s as easy to guess', (password) => {
    expect(passwordStrength(password)).toMatchObject({ score: 1, label: 'Fácil de adivinar', easyToGuess: true })
  })

  it('flags passwords built from the name or email', () => {
    expect(passwordStrength('AnaLopez-2024!', ['ana.lopez@example.com', 'Ana López']).easyToGuess).toBe(true)
    expect(passwordStrength('Lopez1990!!!!', ['', 'Ana López']).easyToGuess).toBe(true)
    // Short name parts appear by chance in good passphrases
    expect(passwordStrength('banana split sundae', ['ana@example.com', 'Ana']).easyToGuess).toBe(false)
  })

  // Spaces count as symbols, so a passphrase of words already mixes two kinds of character
  it('rates long and varied passwords higher', () => {
    expect(passwordStrength('correct horse battery staple').score).toBe(4)
    expect(passwordStrength('Correct horse battery 9!').score).toBe(5)
    expect(passwordStrength('tranquilo verde 42').label).toBe('Excelente')
  })
})
