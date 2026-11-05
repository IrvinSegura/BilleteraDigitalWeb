# Billetera Digital — web

React + TypeScript + Vite front for the digital wallet API (`billeterra-digital` repo): Tailwind CSS 4, shadcn
components on Base UI, TanStack Query, React Hook Form + Zod and Recharts. Light and dark themes, phone to desktop.

## Run locally

1. Start the API (in the backend repo): `docker compose up -d`, then `./mvnw spring-boot:run`. It listens on
   `http://localhost:8080`; Mailpit shows the emails it sends at `http://localhost:8025`.
2. Here: `npm install`, then `npm run dev` and open `http://localhost:3000`.

The dev server runs on port 3000 because the API's email links (`/verify-email`, `/reset-password`) and the payment
return page (`/deposits/return`) point there. It proxies `/api` to the API (`API_PROXY_TARGET`, default
`http://localhost:8080`), so the browser only talks to its own origin: no CORS setup, and the `SameSite=Strict`
refresh cookie works.

## Modules

| Path | What it does |
| --- | --- |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Sign-in with two-factor step, sign-up, password reset and email links |
| `/` | Balance card, money in/out this month (summed by the API), balance chart over 7, 30 or 90 days, recent activity, account checklist |
| `/wallets`, `/wallets/:id` | One wallet per currency (MXN, USD), movements filtered by dates, type, direction and folio, CSV export |
| `/wallets/:id/statement` | A month's statement (opening and closing balance, every movement), to print or save as PDF |
| `/wallets/:id/receipts/:transactionId` | One movement's receipt: print or PDF, or shared as a PNG image (share sheet or download) |
| Deposit / Send / Withdraw dialogs | Opened from anywhere; each money movement carries its own `Idempotency-Key`. Sending offers recent recipients and names who the email belongs to before confirming; sending and withdrawing show what the daily limit still allows |
| Request ("Cobrar") dialog, `/send` | A payment link and QR code (`/send?to=&amount=&currency=&concept=`) that opens the payer's send dialog filled in for review; nothing is stored |
| `/bank-accounts` | CLABE accounts for SPEI withdrawals (check digit validated, 24 h cooling-off shown) |
| `/notifications` | Notices with unread filter; new ones arrive live (see below) |
| `/settings` | Name and phone, email verification, which notices also arrive by email, active sessions (end one or all the others), password change, authenticator app (QR + recovery codes) |
| `/admin/*` | Users, operations lookup, reconciliations, ledger, payment provider, audit log (admins with two-factor on) |
| Search fields | Users, operations, audit log and folio preview up to 6 matches as you type (`SuggestInput`); the recipient field only looks among people already paid, so it can't reveal who has an account |

Code lives by feature in `src/features/*`; shared pieces are in `src/components`, `src/lib` and `src/api`.

## How it talks to the API

Every call sends the language the app shows as `Accept-Language`, and a signed-in app saves it to the account whenever it
changes, so emails go out in that language.

- `src/api/schema.d.ts` is generated from the API's OpenAPI document; regenerate it with `npm run api:generate`
  (API running) whenever its endpoints change.
- `src/api/client.ts` is the typed client (`openapi-fetch`). Calls go through `unwrap`, which throws an
  `ApiError` carrying the API's error `code`; `errorMessage` turns it into a Spanish message.
- Sessions use the API's browser mode (`X-Session-Mode: cookie`): the access token lives only in memory and the
  refresh token in an `HttpOnly` cookie. A reload restores the session with `/api/v1/auth/refresh`, a 401 on any
  call renews the token once and retries, and an API that doesn't answer shows a retry screen instead of
  signing the user out.
- Admin endpoints need a session that signed in with a two-factor code; turning two-factor on signs the user out
  so the next sign-in gets one.
- New notifications arrive over a server-sent event stream (`/api/v1/notifications/stream`), read with `fetch`
  because `EventSource` can't send the access token (`src/features/notifications/live.ts`). Each one refreshes the
  inbox, balances and movements, with a toast for what the user didn't do themselves. The stream reconnects when
  the server closes it and backs off after failures; a hidden tab lets go of it. While it is connected the bell
  polls every five minutes instead of every 30 seconds.

## Installing and offline use

- The app is installable (`public/manifest.webmanifest`, icons in `public/icons`). In builds a service worker
  (`public/sw.js`) keeps the app itself: pages from the network with the last one as a fallback, hashed files
  from the cache. It never caches API answers.
- Opened without a connection, the app shows the last data the user saw (wallets, movements, notifications) with a
  notice of when it was saved, and reloads when the connection is back. That snapshot is in `localStorage`
  (`src/auth/offline-snapshot.ts`), holds no tokens, expires after seven days and is deleted on sign-out, idle
  sign-out or an expired session.

## Security

- Sessions: access token in memory only, refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie that the
  API accepts only with the `X-Session-Mode` header (no CSRF).
- Ten minutes without activity in any tab shows a one-minute warning, then signs out (`src/auth/IdleGuard.tsx`).
- Signing out in one tab signs out every tab; signing in lets waiting tabs pick up the session
  (`src/auth/session-sync.ts`).
- A deposit only redirects to an `https` checkout on a known provider host (`src/features/money/checkout-url.ts`).
- `npm run build` writes the production headers (CSP with the inline theme script's hash, HSTS,
  `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy) to `dist/_headers` (Netlify, Cloudflare
  Pages) and `dist/nginx-security-headers.conf` (nginx: `include` it in the `server` block). `npm run preview` serves
  the build with them on `http://localhost:4173`. Rebuild after changing the inline script in `index.html`: its hash
  changes. See `security-headers.ts`.
- `npm audit --omit=dev` reports nothing. `npm audit` still lists moderate and low advisories in build-time tools
  only (`minimatch` inside `openapi-typescript` and the `shadcn` CLI, `deepmerge` in `shadcn`): none reaches the
  bundle, and their fixes break those tools or don't exist yet, so they wait for upstream releases.

## Errors and monitoring

- A screen that fails to render shows an error screen instead of a blank page: one boundary around the whole app
  and one around each layout's page, so the navigation keeps working and going to another page clears the error
  (`src/components/ErrorBoundary.tsx`).
- A tab left open across a release asks for screen chunks that no longer exist; it reloads once to pick up the
  new release, then offers a reload button instead of looping (`src/lib/chunk-reload.ts`).
- Errors go to Sentry when `VITE_SENTRY_DSN` is set (empty turns it off). The SDK loads in its own chunk after
  start-up, only with a DSN. Nothing identifying is sent: no user, cookies, query strings, URL fragments (emailed
  tokens), bodies or console output (`src/lib/monitoring.ts`). The build adds the DSN's ingest origin to the CSP's
  `connect-src`; set `VITE_APP_VERSION` (e.g. the commit SHA) so reports name their build.

## Tests

- `npm test`: unit and component tests with Vitest and Testing Library (`src/**/*.test.ts(x)`); `npm run
  test:coverage` adds a coverage report.
- `npm run test:e2e`: end-to-end flows with Playwright (`e2e/`) against the local API and Mailpit, which must be
  running (see *Run locally*); it starts the dev server if it isn't up. Each test creates its own users through
  the API, verified with the emailed link and, where needed, with an authenticator app, so runs are independent.
  The API rate-limits auth requests per address and every test comes from localhost: refused ones are sent again
  after a pause (`e2e/support/fixtures.ts`), so a full run takes about a minute. `npm run test:e2e:ui` opens
  Playwright's UI mode.
- `e2e/accessibility.spec.ts` checks the main screens and dialogs with axe (WCAG 2.1 A and AA).
- `e2e/admin.spec.ts` makes its administrator by setting the role in the database (the API has no endpoint for it),
  with `docker exec` on the backend's PostgreSQL container: `E2E_DB_CONTAINER` (default
  `billeterra-digital-postgres-1`), `E2E_DB_NAME` (`wallet`) and `E2E_DB_USER` (`wallet_owner`) point it elsewhere.
- Unit tests share helpers in `src/test`: `stubApi()` (a fake API behind `fetch`; import the code under test after
  it), the `auth` mock with `testUser()`, `renderWithProviders`/`renderDialog` and common fixtures.
- `e2e/offline.spec.ts` needs the service worker, which only the build has: run it with `npm run build`, then
  `npm run preview` and `E2E_PREVIEW=1 E2E_BASE_URL=http://localhost:4173 npm run test:e2e -- offline`.
- CI (`.github/workflows/ci.yml`) runs the linter, the type-checked build and the unit tests on every pull request.
  The end-to-end tests need the API, so they run locally.

## Deploying

Serve the app from the API's own site (same origin, or the same reverse proxy) and leave `VITE_API_URL` empty.
If the API is on another origin, it must be on the same site (e.g. `app.example.com` and `api.example.com`): set
`VITE_API_URL` to it and add this app's origin to the API's `CORS_ALLOWED_ORIGINS`. Set the API's
`wallet.notifications.email.app-url` and `wallet.payments.return-url` to this app's address.
