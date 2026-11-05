// Where the end-to-end tests find the app and the local mail catcher. The app's dev server proxies /api to the
// API, so the tests reach both through one origin, as the browser does.
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'
