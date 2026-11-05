import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Cloudflare Turnstile, which the API asks for on sign-up and password reset requests (`captchaToken`). Off when
 * VITE_TURNSTILE_SITE_KEY is empty, as in development: the widget renders nothing and forms send no token.
 */
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined

export const humanCheckEnabled = Boolean(siteKey)

interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<Turnstile> | null = null

// Loaded on the first form that needs it, once for the whole app
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')))
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Turnstile failed to load'))
    }
    document.head.append(script)
  })
  return loading
}

/**
 * The widget; `onToken` gets its token, or null once it expires or fails. A token works once, so after each submit
 * the form remounts this (a new `key`) to get another.
 *
 * @param onToken must keep its identity across renders, e.g. a state setter
 */
export function HumanCheck({ onToken }: { onToken: (token: string | null) => void }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey || !container.current) {
      return
    }
    let cancelled = false
    let widgetId: string | undefined
    onToken(null)
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) {
          return
        }
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          language,
          theme: 'auto',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (widgetId) {
        window.turnstile?.remove(widgetId)
      }
    }
  }, [onToken, language])

  if (!siteKey) {
    return null
  }
  return failed ? (
    <p role="alert" className="text-sm text-destructive">
      {t('humanCheck.loadFailed')}
    </p>
  ) : (
    <div ref={container} className="min-h-[65px]" />
  )
}
