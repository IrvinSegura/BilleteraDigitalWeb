import { z } from 'zod'

import { hasMarkup } from '@/lib/plain-text'

/** What a payment link asks for: who gets paid and, optionally, how much and what for. */
export interface PaymentRequest {
  to: string
  amount?: string
  currency?: string
  concept?: string
}

export const MAX_CONCEPT = 140
const emailSchema = z.email()
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/

/**
 * The link that opens "Enviar dinero" filled in for the payer. It carries only what the requester chose to share:
 * their email and the amount and concept they typed.
 */
export function paymentLink(origin: string, request: PaymentRequest): string {
  const params = new URLSearchParams({ to: request.to })
  if (request.amount) params.set('amount', request.amount)
  if (request.currency) params.set('currency', request.currency)
  if (request.concept?.trim()) params.set('concept', request.concept.trim())
  return `${origin}/send?${params}`
}

/**
 * Reads a payment link's query. The link may come from anyone, so every field is checked and a bad one dropped:
 * the payer still reviews everything before sending.
 */
export function parsePaymentLink(params: URLSearchParams): PaymentRequest | null {
  const to = params.get('to')?.trim().toLowerCase() ?? ''
  if (!emailSchema.safeParse(to).success) return null
  const amount = params.get('amount') ?? ''
  const currency = params.get('currency') ?? ''
  const concept = params.get('concept')?.trim().slice(0, MAX_CONCEPT)
  return {
    to,
    amount: AMOUNT.test(amount) && Number(amount) > 0 ? amount : undefined,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : undefined,
    // The API would refuse the transfer with it
    concept: concept && !hasMarkup(concept) ? concept : undefined,
  }
}
