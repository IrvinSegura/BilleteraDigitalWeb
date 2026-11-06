interface ImportMetaEnv {
  /** Base URL of the API, without a trailing slash; empty to call /api on this app's own origin. */
  readonly VITE_API_URL: string
  /** Sentry DSN for browser error reports; empty turns reporting off. */
  readonly VITE_SENTRY_DSN?: string
  /** Version reported with each error (e.g. the commit SHA), so a report points at the build that sent it. */
  readonly VITE_APP_VERSION?: string
  /** Cloudflare Turnstile site key for sign-up and password reset; empty when the API doesn't ask for a CAPTCHA. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** Where people who can't sign in reach support, shown on the sign-in page; empty hides it. */
  readonly VITE_SUPPORT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
