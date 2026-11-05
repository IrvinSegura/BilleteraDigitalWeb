import { dehydrate, type DehydratedState, hydrate, type QueryClient } from '@tanstack/react-query'

import type { User } from './auth-context'

/**
 * The last data the signed-in user saw (wallets, movements, notifications), kept so the app can show it when it
 * opens without a connection. It never holds tokens, and signing out (or the session ending) deletes it, so on a
 * shared computer nothing outlives the session.
 */
interface Snapshot {
  version: 1
  savedAt: number
  user: User
  queries: DehydratedState
}

const KEY = 'wallet.offline'
// Older than this, it says more about the past than the present
const MAX_AGE_MS = 7 * 86_400_000
// localStorage holds about 5 MB per origin, shared with the app's other keys
const MAX_CHARS = 1_500_000
const KEPT = new Set(['wallets', 'notifications', 'bank-accounts', 'transfers'])

export function saveSnapshot(queryClient: QueryClient, user: User) {
  const queries = dehydrate(queryClient, {
    // A month's statement can hold thousands of movements; it is fetched again when opened
    shouldDehydrateQuery: (query) => query.state.status === 'success'
      && KEPT.has(String(query.queryKey[0])) && !query.queryKey.includes('statement'),
  })
  const json = JSON.stringify({ version: 1, savedAt: Date.now(), user, queries } satisfies Snapshot)
  if (json.length > MAX_CHARS) return
  try {
    localStorage.setItem(KEY, json)
  } catch {
    // Storage full or blocked: the app just won't have it offline
  }
}

/** Puts the snapshot's data in the query cache and returns when it was saved and whose it is; null if none. */
export function restoreSnapshot(queryClient: QueryClient): { user: User; savedAt: number } | null {
  try {
    const snapshot = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Snapshot | null
    if (snapshot?.version !== 1 || Date.now() - snapshot.savedAt > MAX_AGE_MS) return null
    hydrate(queryClient, snapshot.queries)
    return { user: snapshot.user, savedAt: snapshot.savedAt }
  } catch {
    return null
  }
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing could have been saved either
  }
}
