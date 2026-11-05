import type { Breadcrumb, ErrorEvent } from '@sentry/react'

// Browser error reporting with Sentry. Off unless VITE_SENTRY_DSN is set; then the SDK loads in its own chunk
// after the app starts, so it never delays the first paint and isn't downloaded at all without a DSN.
const dsn = import.meta.env.VITE_SENTRY_DSN

type Sdk = typeof import('./sentry')

let sdk: Sdk | null = null

// Errors reported while the SDK is still loading; a crash on startup is the one most worth seeing
const queued: { error: unknown; context?: Record<string, string> }[] = []
const MAX_QUEUED = 20

/** A URL without its query and fragment: emailed tokens travel in the fragment, searches carry emails. */
export function stripUrl(url: string): string {
  return url.replace(/[?#].*$/, '')
}

/**
 * Last look at an event before it leaves the browser. This is a wallet: nothing that identifies the user or
 * their session goes to a third party, only the error, the page and the app version.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const userAgent = event.request.headers?.['User-Agent']
    event.request = {
      url: event.request.url && stripUrl(event.request.url),
      headers: userAgent ? { 'User-Agent': userAgent } : undefined,
    }
  }
  delete event.user
  return event
}

/** Drops console output (it may print anything) and strips queries and fragments from every URL kept. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') {
    return null
  }
  const data = breadcrumb.data
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') {
        data[key] = stripUrl(data[key])
      }
    }
  }
  return breadcrumb
}

/** Starts error reporting when a DSN is configured; a failure to load it never affects the app. */
export function initMonitoring() {
  if (!dsn) {
    return
  }
  import('./sentry')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION || undefined,
        // No user, cookies, query strings or bodies, and only the User-Agent header; scrubEvent checks again.
        // No performance tracing or session replay either.
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
          httpBodies: [],
          urlQueryParams: false,
        },
        // Errors from browser extensions and other scripts aren't the app's
        allowUrls: [window.location.origin],
        ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications'],
        beforeSend: scrubEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      })
      sdk = Sentry
      for (const { error, context } of queued.splice(0)) {
        Sentry.captureException(error, { tags: context })
      }
    })
    .catch(() => {
      queued.length = 0
    })
}

/**
 * Reports an unexpected error, such as a screen that failed to render. API errors the screens already explain
 * (a 4xx with its code) aren't worth reporting. context becomes searchable tags (e.g. which boundary caught it).
 */
export function reportError(error: unknown, context?: Record<string, string>) {
  if (!dsn) {
    return
  }
  if (sdk) {
    sdk.captureException(error, { tags: context })
  } else if (queued.length < MAX_QUEUED) {
    queued.push({ error, context })
  }
}
