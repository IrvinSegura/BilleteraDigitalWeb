import { describe, expect, it } from 'vitest'

import '@/i18n'
import { en } from '@/i18n/locales/en'
import { es } from '@/i18n/locales/es'

import { notificationText, notificationTitle } from './notification-text'

// Each text exactly as the API's NotificationMessages writes it
const stored = {
  WELCOME: { title: 'Welcome to Digital Wallet', body: 'Open a wallet in MXN or USD to start sending and receiving money.' },
  ACCOUNT_LOCKED: {
    title: 'Sign-in blocked after failed attempts',
    body: "Someone entered a wrong password for your account several times, so signing in is blocked until 2026-11-03 18:30 UTC. If it wasn't you, reset your password: that also unblocks your account.",
  },
  PASSWORD_CHANGED: {
    title: 'Your password was changed',
    body: "Your Digital Wallet password was changed and every other device was signed out. If it wasn't you, reset your password right away and contact support.",
  },
  TWO_FACTOR_ENABLED: {
    title: 'Two-factor authentication is on',
    body: 'Signing in now also asks for a code from your authenticator app. Keep your recovery codes somewhere safe: they are the way back in if you lose your phone.',
  },
  TWO_FACTOR_DISABLED: {
    title: 'Two-factor authentication is off',
    body: "Two-factor authentication was turned off on your account. If it wasn't you, change your password right away and contact support.",
  },
  ACCOUNT_DISABLED: {
    title: 'Account disabled',
    body: 'Your account was disabled: you cannot sign in or move money until our team reviews it. Contact support if you have questions.',
  },
  ACCOUNT_ENABLED: { title: 'Account active again', body: 'You can sign in and move money again.' },
  DEPOSIT_RECEIVED: { title: 'Deposit received', body: '5000.00 MXN was added to your wallet.' },
  DEPOSIT_REJECTED: {
    title: 'Deposit refunded',
    body: 'Your payment of 300.50 USD went through, but your wallet cannot receive money right now, so it was not added. The payment is being refunded to your card.',
  },
  BANK_ACCOUNT_ADDED: {
    title: 'Bank account added',
    body: 'The bank account ending in 1234 was added and can receive your withdrawals once its waiting period ends. If you did not add it, remove it and change your password right away.',
  },
  WITHDRAWAL_SENT: { title: 'Withdrawal sent', body: '750.00 MXN was sent to your bank account.' },
  WITHDRAWAL_FAILED: {
    title: 'Withdrawal returned',
    body: 'Your bank could not receive your withdrawal of 750.00 MXN, so the money is back in your wallet. Check your bank details or contact support.',
  },
  TRANSFER_SENT: { title: 'Transfer sent', body: 'You sent 1250.50 MXN to destino.front@wallet.local.' },
  TRANSFER_RECEIVED: { title: 'Money received', body: 'Usuario Prueba sent you 1250.50 MXN.' },
  WALLET_FROZEN: {
    title: 'Wallet frozen',
    body: 'Your USD wallet was frozen: money cannot move in or out of it until our team reviews it. Contact support if you have questions.',
  },
  WALLET_UNFROZEN: { title: 'Wallet active again', body: 'Your USD wallet can send and receive money again.' },
  BANK_ACCOUNT_REMOVED: {
    title: 'Bank account removed',
    body: 'The bank account ending in 1234 was removed and can no longer receive your withdrawals. If you did not remove it, change your password right away and contact support.',
  },
  PHONE_CHANGED: {
    title: 'Phone number changed',
    body: "The phone number on your account was changed. If it wasn't you, change your password right away and contact support.",
  },
  ACCOUNT_UNLOCKED: {
    title: 'Sign-in unblocked',
    body: 'Our support team unblocked signing in to your account. You can sign in again with your password.',
  },
  SUPPORT_CASE_ASSIGNED: {
    title: 'New support case',
    body: 'A user is waiting for you. Open the case to see everything said with the bot.',
  },
  SUPPORT_AGENT_JOINED: {
    title: 'Support is with you',
    body: 'An agent has joined your conversation and has everything you told the bot.',
  },
  SUPPORT_AGENT_REPLIED: {
    title: 'Support replied',
    body: 'You have a new message from support.',
  },
  SUPPORT_CASE_RESOLVED: {
    title: 'Your support case was closed',
    body: 'Tell us how it went: it only takes a moment.',
  },
  SUPPORT_TICKET_RESOLVED: { title: 'Your case was settled', body: 'Confirmamos el pago con el proveedor y acreditamos el depósito.' },
  SUPPORT_ESCALATION_RESOLVED: { title: 'A ticket you escalated was settled', body: 'Acreditamos el depósito.' },
  WALLET_ADJUSTED: { title: 'Money added to your wallet', body: 'We added 250.00 MXN to your wallet: Depósito que no llegó' },
  IDENTITY_VERIFIED: {
    title: 'Your identity is verified',
    body: 'We reviewed your INE and confirmed your identity. You can now withdraw money to your bank accounts.',
  },
  IDENTITY_REJECTED: { title: 'We could not verify your identity', body: 'We reviewed your INE and could not verify it: La foto está borrosa' },
  SESSIONS_REVOKED: {
    title: 'Sessions signed out',
    body: "3 of your sessions were signed out. If it wasn't you, change your password right away.",
  },
}

describe('notices added with the account security emails', () => {
  it('reads their figures back in both languages', () => {
    expect(spanish('BANK_ACCOUNT_REMOVED').body).toContain('terminación 1234')
    expect(english('BANK_ACCOUNT_REMOVED').body).toContain('ending in 1234')
    expect(spanish('SESSIONS_REVOKED').body).toContain('Se cerraron 3 de tus sesiones')
    expect(spanish('PHONE_CHANGED').title).toBe('Cambió tu celular')
    expect(spanish('ACCOUNT_UNLOCKED').title).toBe('Inicio de sesión desbloqueado')
  })

  it('says one session in singular', () => {
    const one = notificationText({ type: 'SESSIONS_REVOKED', title: 'Sessions signed out',
      body: "1 of your sessions was signed out. If it wasn't you, change your password right away." }, 'es')
    expect(one.body).toBe('Se cerró una de tus sesiones. Si no fuiste tú, cambia tu contraseña de inmediato.')
  })
})

const spanish = (type: keyof typeof stored) => notificationText({ type, ...stored[type] }, 'es')
const english = (type: keyof typeof stored) => notificationText({ type, ...stored[type] }, 'en')

// Words only the English templates use; none may reach a Spanish screen
const ENGLISH_ONLY = /\b(the|your|was|wallet|sent|received|money|account|password|you|withdrawal|deposit)\b/i

describe('notificationText', () => {
  it.each(Object.keys(stored) as (keyof typeof stored)[])('shows %s entirely in Spanish, with no placeholder left', (type) => {
    const { title, body } = spanish(type)
    expect(title).not.toMatch(ENGLISH_ONLY)
    // The recipient's email and the sender's name are the user's own data, not translated text
    expect(body.replace('destino.front@wallet.local', '').replace('Usuario Prueba', '')).not.toMatch(ENGLISH_ONLY)
    expect(`${title} ${body}`).not.toContain('{{')
    expect(title).toBe(es.notifications.types[type].title)
  })

  it.each(Object.keys(stored) as (keyof typeof stored)[])('shows %s in English when that is the language', (type) => {
    const { title, body } = english(type)
    expect(title).toBe(en.notifications.types[type].title)
    expect(`${title} ${body}`).not.toContain('{{')
  })

  it('keeps the figures the stored text carries, formatted', () => {
    expect(spanish('DEPOSIT_RECEIVED').body).toBe('Se agregaron $5,000.00 MXN a tu billetera.')
    expect(english('DEPOSIT_RECEIVED').body).toBe('$5,000.00 MXN was added to your wallet.')
    expect(spanish('DEPOSIT_REJECTED').body).toContain('$300.50 USD')
    expect(spanish('WITHDRAWAL_SENT').body).toBe('Se enviaron $750.00 MXN a tu cuenta bancaria.')
    expect(spanish('WITHDRAWAL_FAILED').body).toContain('$750.00 MXN')
    expect(spanish('TRANSFER_SENT').body).toBe('Enviaste $1,250.50 MXN a destino.front@wallet.local.')
    expect(spanish('TRANSFER_RECEIVED').body).toBe('Usuario Prueba te envió $1,250.50 MXN.')
    expect(spanish('BANK_ACCOUNT_ADDED').body).toContain('terminación 1234')
    expect(spanish('WALLET_FROZEN').body).toContain('billetera en USD')
    expect(spanish('WALLET_UNFROZEN').body).toContain('billetera en USD')
    expect(spanish('ACCOUNT_LOCKED').body).toContain('2026')
  })

  it('tells a password reset and a support 2FA reset apart from the regular notice', () => {
    expect(notificationText({
      type: 'PASSWORD_CHANGED',
      title: 'Your password was reset',
      body: "Your Digital Wallet password was reset and every other device was signed out. If it wasn't you, reset your password right away and contact support.",
    }, 'es')).toEqual({ title: es.notifications.types.PASSWORD_CHANGED.titleReset, body: es.notifications.types.PASSWORD_CHANGED.bodyReset })
    expect(notificationText({
      type: 'TWO_FACTOR_DISABLED',
      title: 'Two-factor authentication is off',
      body: "Our support team turned off two-factor authentication on your account, as you asked. If it wasn't you, change your password right away and contact support.",
    }, 'es').body).toBe(es.notifications.types.TWO_FACTOR_DISABLED.bodySupport)
  })

  it('translates the name the API uses for an unknown sender', () => {
    expect(notificationText({ type: 'TRANSFER_RECEIVED', title: 'Money received', body: 'another Digital Wallet user sent you 10.00 MXN.' }, 'es').body)
      .toBe('Otro usuario de Billetera te envió $10.00 MXN.')
  })

  it('falls back to a text without figures, not to English, when the stored body changed', () => {
    expect(notificationText({ type: 'DEPOSIT_RECEIVED', title: 'Deposit received', body: 'Something new' }, 'es').body)
      .toBe(es.notifications.types.DEPOSIT_RECEIVED.bodyGeneric)
    expect(notificationText({ type: 'ACCOUNT_LOCKED', title: 'x', body: 'Something new' }, 'es').body)
      .toBe(es.notifications.types.ACCOUNT_LOCKED.bodyGeneric)
  })

  it('gives a type it does not know a generic notice in Spanish, and the API text in English', () => {
    const notice = { type: 'BRAND_NEW', title: 'Brand new', body: 'Something happened' }
    expect(notificationText(notice, 'es')).toEqual(es.notifications.types.UNKNOWN)
    expect(notificationText(notice, 'en')).toEqual({ title: 'Brand new', body: 'Something happened' })
  })
})

describe('notificationTitle', () => {
  it('translates the title of a live event, which has no body', () => {
    expect(notificationTitle('TRANSFER_RECEIVED', 'Money received', 'es')).toBe('Dinero recibido')
    expect(notificationTitle('TRANSFER_RECEIVED', 'Money received', 'en')).toBe('Money received')
  })
})

describe('an adjustment to the wallet', () => {
  it('says how much, which way and why, with what the administrator wrote', () => {
    expect(spanish('WALLET_ADJUSTED').body).toBe('Abonamos $250.00 MXN a tu billetera: Depósito que no llegó')
    expect(english('WALLET_ADJUSTED').body).toBe('We added $250.00 MXN to your wallet: Depósito que no llegó')
    expect(notificationText({ type: 'WALLET_ADJUSTED', title: 'Money taken from your wallet', body: 'We took 10.00 USD from your wallet: Abono duplicado' }, 'es').body)
      .toBe('Cargamos $10.00 USD a tu billetera: Abono duplicado')
  })

  it('still reads well when the body is not what the API writes', () => {
    expect(notificationText({ type: 'WALLET_ADJUSTED', title: 'x', body: 'otro' }, 'es').body).toContain('Hicimos un ajuste')
  })
})

describe('a settled support ticket', () => {
  it('shows what the administrator wrote, inside the sentence of the chosen language', () => {
    expect(spanish('SUPPORT_TICKET_RESOLVED')).toEqual({
      title: 'Resolvimos tu caso',
      body: 'Revisamos lo que reportaste: Confirmamos el pago con el proveedor y acreditamos el depósito.',
    })
    expect(english('SUPPORT_TICKET_RESOLVED').body).toBe('We reviewed what you reported: Confirmamos el pago con el proveedor y acreditamos el depósito.')
  })

  it('still reads well with no resolution stored', () => {
    expect(notificationText({ type: 'SUPPORT_TICKET_RESOLVED', title: 'Your case was settled', body: '' }, 'es').body)
      .toBe('Revisamos lo que reportaste. Consulta los detalles en soporte.')
  })

  it('tells the agent who escalated it what the administrators did', () => {
    expect(spanish('SUPPORT_ESCALATION_RESOLVED')).toEqual({
      title: 'Resolvieron un ticket que escalaste',
      body: 'Administración respondió: Acreditamos el depósito.',
    })
    expect(english('SUPPORT_ESCALATION_RESOLVED').body).toBe('The administrators answered: Acreditamos el depósito.')
  })
})

describe('a reviewed identity', () => {
  it('tells the customer why it was rejected, inside the sentence of the chosen language', () => {
    expect(spanish('IDENTITY_REJECTED')).toEqual({
      title: 'No pudimos verificar tu identidad',
      body: 'Revisamos tu INE y no pudimos verificarla: La foto está borrosa',
    })
    expect(spanish('IDENTITY_VERIFIED').title).toBe('Tu identidad está verificada')
  })

  it('still reads well with no reason stored', () => {
    expect(notificationText({ type: 'IDENTITY_REJECTED', title: 'x', body: '' }, 'es').body)
      .toBe('Revisamos tu INE y no pudimos verificarla. Revisa el motivo y vuelve a enviarla.')
  })
})
