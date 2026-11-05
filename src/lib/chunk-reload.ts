// After a release, a tab opened on the previous one asks for screen chunks whose hashed names no longer exist.
// Reloading picks up the new release; it is done once, so a chunk that keeps failing (offline, a broken deploy)
// shows the error screen instead of reloading forever.
const RELOADED_AT = 'wallet.chunkReloadedAt'
const RETRY_AFTER_MS = 10_000

/** Whether error is a lazily loaded screen (or its CSS) that couldn't be downloaded. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return error.name === 'ChunkLoadError' || [
    'Failed to fetch dynamically imported module', // Chromium
    'error loading dynamically imported module', // Firefox
    'Importing a module script failed', // Safari
    'Unable to preload CSS', // Vite's CSS preload
  ].some((text) => error.message.includes(text))
}

/** Reloads the page unless it was just reloaded for this; true when the reload is under way. */
export function reloadForNewRelease(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT))
    if (last && now - last < RETRY_AFTER_MS) {
      return false
    }
    sessionStorage.setItem(RELOADED_AT, String(now))
  } catch {
    // Storage blocked: without a way to tell a loop apart, show the error screen
    return false
  }
  window.location.reload()
  return true
}
