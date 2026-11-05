import { describe, expect, it } from 'vitest'

import { parsePaymentLink, paymentLink } from './payment-link'

const origin = 'https://billetera.example'

describe('payment links', () => {
  it('round-trips what the requester filled in', () => {
    const link = paymentLink(origin, { to: 'ana@example.com', amount: '150.50', currency: 'MXN', concept: ' Cena ' })

    expect(link).toBe(`${origin}/send?to=ana%40example.com&amount=150.50&currency=MXN&concept=Cena`)
    expect(parsePaymentLink(new URL(link).searchParams))
      .toEqual({ to: 'ana@example.com', amount: '150.50', currency: 'MXN', concept: 'Cena' })
  })

  it('leaves out the optional fields nobody filled in', () => {
    expect(paymentLink(origin, { to: 'ana@example.com', concept: '  ' })).toBe(`${origin}/send?to=ana%40example.com`)
  })

  it('needs a valid email to be a link at all', () => {
    expect(parsePaymentLink(new URLSearchParams('to=not-an-email&amount=10'))).toBeNull()
    expect(parsePaymentLink(new URLSearchParams('amount=10'))).toBeNull()
  })

  it('drops a bad amount or currency and cuts a long concept, keeping the rest', () => {
    const request = parsePaymentLink(new URLSearchParams({
      to: 'Ana@Example.com', amount: '-5', currency: 'pesos', concept: 'x'.repeat(200),
    }))

    expect(request).toEqual({ to: 'ana@example.com', amount: undefined, currency: undefined, concept: 'x'.repeat(140) })
    expect(parsePaymentLink(new URLSearchParams('to=ana@example.com&amount=1.234'))?.amount).toBeUndefined()
    expect(parsePaymentLink(new URLSearchParams('to=ana@example.com&amount=0'))?.amount).toBeUndefined()
  })

  it('drops a concept with markup, which the API would refuse', () => {
    const request = parsePaymentLink(new URLSearchParams({ to: 'ana@example.com', concept: '<img src=x onerror=alert(1)>' }))

    expect(request?.concept).toBeUndefined()
  })
})
