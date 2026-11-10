# Billetera Digital — web

React + TypeScript + Vite front for the digital wallet API
([BilleteraDigital-](https://github.com/IrvinSegura/BilleteraDigital-), the `billeterra-digital` folder): Tailwind
CSS 4, shadcn components on Base UI, TanStack Query, React Hook Form + Zod and Recharts. Light and dark themes, phone to desktop.

## Screenshots

Taken from the app running locally with demo people (`docs/screenshots`). Open each section's list for the rest.

### Customers

| | |
| --- | --- |
| ![Customer home](docs/screenshots/customer-dashboard.png) | ![A wallet and its movements](docs/screenshots/customer-wallet.png) |
| Home: balance, money in and out this month, balance chart, recent activity | A wallet: balance chart, movements, filters, CSV and statement |
| ![Send money, confirmation step](docs/screenshots/customer-send.png) | ![Statements with the date range calendar](docs/screenshots/customer-statements.png) |
| Sending: the transfer reviewed before it goes | Statements: the period picked on a calendar, with shortcuts |

<details>
<summary>More customer screens (11)</summary>

| | |
| --- | --- |
| ![Sign-in page](docs/screenshots/auth-login.png) | ![A movement](docs/screenshots/customer-movement.png) |
| Sign-in | A movement, with its folio, receipt and "report a problem" |
| ![A movement receipt](docs/screenshots/customer-receipt.png) | ![Request money with a QR code](docs/screenshots/customer-request.png) |
| Its receipt, to print, save as PDF or share as an image | Request money: a payment link and QR code |
| ![Withdraw dialog](docs/screenshots/customer-withdraw.png) | ![Bank accounts](docs/screenshots/customer-bank-accounts.png) |
| Withdrawing: identity check and the new bank account's waiting period | Bank accounts (CLABE) for withdrawals |
| ![Account settings](docs/screenshots/customer-settings.png) | ![Support chat](docs/screenshots/customer-support.png) |
| My account: profile, two-factor, sessions, identity, email notices, password | Support: the bot first, then a person |
| ![Home in the dark theme](docs/screenshots/customer-dashboard-dark.png) | <img src="docs/screenshots/customer-phone.png" alt="Home on a phone" width="260"> |
| Dark theme | On a phone, with the tab bar |
| <img src="docs/screenshots/customer-phone-support.png" alt="Support chat on a phone" width="260"> |  |
| Support on a phone |  |

</details>

### Support agents

| | |
| --- | --- |
| ![Support inbox](docs/screenshots/support-inbox.png) | ![A support case](docs/screenshots/support-case.png) |
| Inbox: the queue, the agent's figures and their cases | A case: header and actions, the customer's operations and what was escalated, then the chat |
| ![Customer tab of a case](docs/screenshots/support-customer.png) | ![Escalated tickets](docs/screenshots/support-escalated.png) |
| The customer's standing, identity included | Escalated: what the agent passed to administration |

<details>
<summary>More support screens (4)</summary>

| | |
| --- | --- |
| ![History tab of a case](docs/screenshots/support-history.png) | ![Notes tab of a case](docs/screenshots/support-notes.png) |
| The customer's earlier cases | Notes for the team, which the customer never reads |
| ![Suggest an answer to the bot](docs/screenshots/support-teach.png) | ![Close a case with a reason](docs/screenshots/support-resolve.png) |
| Teaching the bot an answer | Closing a case with its reason |

</details>

### Administrators

| | |
| --- | --- |
| ![Administration home](docs/screenshots/admin-home.png) | ![A user in the console](docs/screenshots/admin-users.png) |
| Home: money, operations and customers of the period, and what waits for an administrator | A user: account, two-factor, lockout and wallets (adjust, freeze) |
| ![Support tickets](docs/screenshots/admin-tickets.png) | ![Support cases](docs/screenshots/admin-support.png) |
| Tickets escalated by support | Support: the queue, how cases end and each case |

<details>
<summary>More administration screens (10)</summary>

| | |
| --- | --- |
| ![Balance adjustments](docs/screenshots/admin-adjustments.png) | ![An adjustment waiting for approval](docs/screenshots/admin-adjustment.png) |
| Balance adjustments | A large one waits for a second administrator |
| ![Support team](docs/screenshots/admin-support-team.png) | ![Support bot](docs/screenshots/admin-support-bot.png) |
| Support: each agent's figures | Support: what the bot couldn't answer and the agents' suggestions |
| ![Wallets](docs/screenshots/admin-wallets.png) | ![Operations](docs/screenshots/admin-operations.png) |
| Wallets by state | Operations: the last 7 days, what is pending, lookup by id |
| ![Reconciliations](docs/screenshots/admin-reconciliations.png) | ![Ledger](docs/screenshots/admin-ledger.png) |
| Reconciliations of the ledger | Ledger: the system accounts by currency |
| ![Payment provider](docs/screenshots/admin-payments.png) | ![Audit log](docs/screenshots/admin-audit.png) |
| Payment provider: its balance against the books, and its movements | Audit log, filtered by action, dates, actor and target |

</details>

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
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email-change` | Sign-in with two-factor step, sign-up, password reset and email links (confirming a new address signs out every session) |
| `/change-password` | Where a new team account stays until it replaces the temporary password it was emailed |
| `/` | Balance card, money in/out this month (summed by the API), balance chart over 7, 30 or 90 days, recent activity, account checklist |
| `/wallets`, `/wallets/:id` | One wallet per currency (MXN, USD), movements with the other person and the concept, filtered by dates, type, direction and text (person, concept or folio), CSV export |
| `/wallets/:id/statement` | A month's statement (opening and closing balance, every movement), to print or download as a PDF file |
| `/statements` | Every statement in one place: each wallet's period at a glance, its PDF, and a general PDF covering all wallets. The period is the last month, the last three months, or dates picked on a calendar (`DateRangePicker`): two months side by side (one on a phone), shortcuts (previous full month, last 7, 30 or 90 days, year to date), nothing before the user's first record, after today or longer than 366 days, keyboard included; it only counts once applied. PDFs are built in the browser with jsPDF (loaded only when one is downloaded): table header on every page, folio and page numbers |
| `/wallets/:id/receipts/:transactionId` | One movement's receipt: print or PDF, or shared as a PNG image (share sheet or download) |
| Deposit / Send / Withdraw dialogs | Opened from anywhere; each money movement carries its own `Idempotency-Key`. Sending offers recent recipients and names who the email belongs to before confirming; sending and withdrawing show what the daily limit still allows |
| Request ("Cobrar") dialog, `/send` | A payment link and QR code (`/send?to=&amount=&currency=&concept=`) that opens the payer's send dialog filled in for review; nothing is stored |
| `/bank-accounts` | CLABE accounts for SPEI withdrawals (check digit validated, 24 h cooling-off shown), each with an optional name of the owner's |
| `/notifications` | Notices with unread filter; new ones arrive live (see below). Delete one, or every read one |
| `/settings` | Name and phone, email verification, which notices also arrive by email, active sessions (end one or all the others), password change, authenticator app (QR + recovery codes), change of email (link to the new address), a JSON copy of the account's data, and closing the account (only with no balance and nothing pending) |
| `/support` | Chat with support: a bot that answers from the API's Markdown files, then a person. Files (JPG, PNG, WebP, PDF, MP4 up to 20 MB), and a survey when an agent attended it. While it is with a person the chat is read again every 3 s. "Report a problem" on a movement opens it with that movement named (`?wallet=&movement=`), and the report goes straight to a person |
| `/support/inbox` | Support agents (`SUPPORT` role): the queue (who waits, how many are urgent, the longest wait), their own figures for the last 30 days (cases, closed, first reply, survey score) and their cases, searchable by name or folio and filtered by open or closed. An availability switch pauses new cases while keeping the one being attended; alerts for a new case are a sound and, if the browser allows it, a desktop notice (kept in this browser) |
| `/support/inbox/:id` | One case on its own page: a header with the customer, its state, urgency (a problem with money goes first in the queue), folio and actions (teach the bot, give it back to the queue, pass it to a colleague, close it with a reason: solved, information only, escalated, no reply, duplicate or other). Below it, tabs with the customer's standing (identity included, only while open), their operations to escalate one as a ticket (or a problem that isn't about money: account access, identity), their earlier cases and the team's notes, which the customer never reads; then the chat with everything said to the bot, files and saved replies. Its notification opens the case |
| `/support/escalated` | What the agent passed to the administrators from any of their cases, open or settled, with what was done and a link to the case. The menu counts the open ones, and a notice arrives when one is settled |
| `/admin` | Home: the customers' money, the money moved, the operations and the new customers of the period (7, 30 or 90 days) against the one before; what is waiting for an administrator (identity to review, open tickets, adjustments to approve, unmatched provider movements); money moved per day, whether the books and the provider add up, new customers per day, accounts and wallets by state, support and the latest activity |
| `/admin/adjustments`, `/admin/adjustments/:id` | Manual credits and debits to a wallet, with a reason, started from a user's wallet or a ticket. Above the API's limit they wait for a second administrator, who approves or rejects them; whoever asked can't approve but can withdraw |
| `/admin/*` | Users (filtered by state and type, including making someone a support agent and creating team accounts, whose owner gets their role, address and a temporary password by email: nobody else sees it, and they must change it when they sign in) and wallets (counts and lists filtered by state, kept in the address), operations (the last 7 days' totals, what is still pending, and lookup by id), reconciliations, ledger, payment provider, support (the queue and how cases end, each case with its survey, close reason and notes; each agent's figures; and what the bot couldn't answer, with the agents' suggestions to add to its knowledge), audit log (admins with two-factor on) |
| Any other address | A not-found page with the way home |
| Search fields | Users, operations, audit log and movements preview up to 6 matches as you type (`SuggestInput`); the recipient field only looks among people already paid, so it can't reveal who has an account |

On a computer the side menu can be hidden with the button at the top left, for any role, to give the page the whole
width; the browser remembers it. Phones use the menu button and the bottom tab bar instead.

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
- `e2e/support.spec.ts` makes its agent the same way. Any free agent can get its case, so it first turns the agents
  of earlier runs back into customers and closes the cases they left in the queue (test accounts only).
- `e2e/identity.spec.ts` (an INE sent from the settings, then approved and rejected in the console) and
  `e2e/adjustments.spec.ts` (a credit applied at once, a large one approved by a second administrator, and a
  withdrawn request) make their administrators the same way. The API takes each CURP and voter key once, so every
  run generates valid new ones, and the photos are PNGs built in the test (`e2e/support/identity.ts`).
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
`wallet.notifications.email.app-url` and `wallet.payments.return-url` to this app's address. Set
`VITE_SUPPORT_EMAIL` to the inbox that answers people who can't sign in: the support chat needs a session, so the
sign-in page shows this address to them, and hides it when empty.
