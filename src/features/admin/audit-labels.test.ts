import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { labelOf } from '@/lib/labels'

import { auditActions, auditDetails, endOfDay, startOfDay } from './audit-labels'

const A = '3f2a91bc-1111-4222-8333-444455556666'
const B = 'aaaabbbb-1111-4222-8333-444455556666'

afterEach(async () => {
  await i18n.changeLanguage('es')
})

describe('auditDetails', () => {
  it.each([
    ['USER_REGISTERED', 'role USER', 'Rol: '],
    ['SESSIONS_REVOKED', '3 ended', 'Sesiones cerradas: 3'],
    ['PASSWORD_CHANGED', 'all sessions ended', 'Se cerraron todas las sesiones'],
    ['USER_DISABLED', 'reason: Fraude', 'Motivo: Fraude'],
    ['USER_UNLOCKED', 'reason: Confirmó por teléfono', 'Motivo: Confirmó por teléfono'],
    ['BANK_ACCOUNT_ADDED', `bank account ${A}: bank 012, CLABE ending 1234`, 'banco 012, CLABE terminación 1234'],
    ['BANK_ACCOUNT_REMOVED', `bank account ${A}: CLABE ending 1234`, 'CLABE terminación 1234'],
    ['CAPITAL_CONTRIBUTED', '500.00 MXN, reference REF-1, reason: Fondeo', 'referencia REF-1. Motivo: Fondeo'],
    ['WALLET_OPENED', 'currency USD', 'Moneda: USD'],
    ['DEPOSIT_COMPLETED', `deposit ${A}: 100.00 MXN`, 'Depósito '],
    ['DEPOSIT_REJECTED', `deposit ${A}: 100.00 MXN refunded, frozen`, 'reembolsados. Motivo: frozen'],
    ['WITHDRAWAL_REQUESTED', `withdrawal ${A}: 25.00 MXN`, 'Retiro '],
    ['WITHDRAWAL_FAILED', `withdrawal ${A}: 25.00 MXN returned, bank said no`, 'devueltos. Motivo: bank said no'],
    ['TRANSFER_COMPLETED', `transfer ${A}: 10.00 MXN to wallet ${B}`, 'a la billetera '],
    ['PROFILE_UPDATED', 'FULL_NAME, PHONE', 'Cambió: nombre, teléfono'],
    ['PROVIDER_TRANSACTION_RESOLVED', 'STRIPE txn_1, reason: Ajuste acordado', 'Movimiento txn_1. Motivo: Ajuste acordado'],
  ])('%s has no English left', (action, details, expected) => {
    const text = auditDetails(action, details)
    expect(text).toContain(expected)
    expect(text).not.toMatch(/\b(reason|ending|refunded|returned|reference|deposit|withdrawal|transfer|wallet|ended|currency)\b/)
  })

  it('writes money and dates the way the rest of the app does', () => {
    expect(auditDetails('DEPOSIT_COMPLETED', `deposit ${A}: 100.00 MXN`)).toContain('$100.00')
    expect(auditDetails('USER_LOCKED_OUT', 'locked until 2026-11-03T20:00:00Z')).toMatch(/^Bloqueada hasta .*2026/)
  })

  it('follows the active language', async () => {
    await i18n.changeLanguage('en')

    expect(auditDetails('USER_DISABLED', 'reason: Fraude')).toBe('Reason: Fraude')
    expect(auditDetails('PROFILE_UPDATED', 'FULL_NAME, PHONE')).toBe('Changed: name, phone')
    expect(labelOf('admin.audit.actions', 'WITHDRAWAL_REQUESTED')).toBe('Withdrawal requested')
  })

  it('shows what it does not recognize as it came, and a dash for nothing', () => {
    expect(auditDetails('SOMETHING_NEW', 'a sentence from a newer backend')).toBe('a sentence from a newer backend')
    expect(auditDetails('USER_EMAIL_VERIFIED', undefined)).toBe('—')
  })
})

describe('auditActions', () => {
  it('names every action the backend records', () => {
    auditActions.forEach((action) => expect(labelOf('admin.audit.actions', action)).not.toBe(action))
    expect(auditActions).toEqual(expect.arrayContaining([
      'USER_REGISTERED', 'USER_SIGNED_IN', 'USER_LOCKED_OUT', 'USER_EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED',
      'PASSWORD_RESET', 'PASSWORD_CHANGED', 'PROFILE_UPDATED', 'SESSIONS_REVOKED', 'TWO_FACTOR_ENABLED',
      'TWO_FACTOR_DISABLED', 'USER_UNLOCKED', 'USER_DISABLED', 'USER_ENABLED', 'BANK_ACCOUNT_ADDED',
      'BANK_ACCOUNT_REMOVED', 'CAPITAL_CONTRIBUTED', 'WALLET_OPENED', 'WALLET_FROZEN', 'WALLET_UNFROZEN',
      'DEPOSIT_COMPLETED', 'DEPOSIT_REJECTED', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_COMPLETED', 'WITHDRAWAL_FAILED',
      'TRANSFER_COMPLETED', 'PROVIDER_TRANSACTION_RESOLVED',
    ]))
  })
})

describe('day bounds', () => {
  it('covers the whole local day, with the upper bound on the next one', () => {
    const from = new Date(startOfDay('2026-11-03'))
    const to = new Date(endOfDay('2026-11-03'))
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([2026, 10, 3, 0])
    expect([to.getFullYear(), to.getMonth(), to.getDate(), to.getHours()]).toEqual([2026, 10, 4, 0])
  })
})
