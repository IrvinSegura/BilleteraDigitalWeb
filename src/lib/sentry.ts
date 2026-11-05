// The only parts of the Sentry SDK the app uses. monitoring.ts loads this module lazily; importing the whole SDK
// that way would bundle all of it, since a dynamically imported namespace can't be tree-shaken.
export { captureException, init } from '@sentry/react'
