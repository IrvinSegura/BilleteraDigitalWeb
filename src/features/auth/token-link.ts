import { useState } from 'react'

/**
 * The token of an emailed link (/verify-email#token=…, /reset-password#token=…). It comes in the fragment, which
 * browsers never send to servers or in Referer headers; it is read once and wiped from the address bar so it
 * doesn't stay in the history.
 */
export function useLinkToken(): string | null {
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token')
    if (value) {
      history.replaceState(history.state, '', window.location.pathname + window.location.search)
    }
    return value
  })
  return token
}
