import { describe, expect, it } from 'vitest'

import { isTrustedCheckoutUrl } from './checkout-url'

describe('isTrustedCheckoutUrl', () => {
  it('accepts an https page on the provider checkout', () => {
    expect(isTrustedCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_a1b2c3#fid')).toBe(true)
  })

  it.each([
    ['plain http', 'http://checkout.stripe.com/c/pay/cs_test'],
    ['another host', 'https://evil.example/c/pay/cs_test'],
    ['a look-alike subdomain', 'https://checkout.stripe.com.evil.example/c/pay'],
    ['a provider subdomain not on the list', 'https://evil.checkout.stripe.com/c/pay'],
    ['credentials before the host', 'https://user:pass@checkout.stripe.com/c/pay'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a relative path', '/c/pay/cs_test'],
    ['an empty string', ''],
  ])('refuses %s', (_, url) => {
    expect(isTrustedCheckoutUrl(url)).toBe(false)
  })
})
