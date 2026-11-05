// Hosts the payer may be sent to for a deposit. The API's only real provider is Stripe, whose hosted checkout
// lives here; a URL anywhere else (a misconfigured or compromised API) is refused rather than followed with the
// user's trust. Add a host here when the API gains another provider.
const TRUSTED_CHECKOUT_HOSTS = ['checkout.stripe.com']

/** A deposit whose checkout points somewhere untrusted; the payer is not sent there. */
export class UntrustedCheckoutError extends Error {
  constructor() {
    super('The checkout URL is not on a trusted host')
    this.name = 'UntrustedCheckoutError'
  }
}

/** Whether the deposit's checkoutUrl is an https page on a known payment provider. */
export function isTrustedCheckoutUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === 'https:' && !url.username && !url.password && TRUSTED_CHECKOUT_HOSTS.includes(url.hostname)
}
