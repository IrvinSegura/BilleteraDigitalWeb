// Tells this app's other tabs when the user signs in or out. The access token lives in each tab's memory, so
// without this a tab left open would keep a signed-out user's session alive until its token expired.
type SessionEvent = 'signed-in' | 'signed-out'

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('wallet.session')

export function announce(event: SessionEvent) {
  channel?.postMessage(event)
}

/** Runs handler for every event another tab announces; returns the unsubscribe. A tab never hears itself. */
export function onSessionEvent(handler: (event: SessionEvent) => void): () => void {
  if (!channel) {
    return () => {}
  }
  const listener = (message: MessageEvent<SessionEvent>) => handler(message.data)
  channel.addEventListener('message', listener)
  return () => channel.removeEventListener('message', listener)
}
