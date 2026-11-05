import { useSyncExternalStore } from 'react'

// Whether this tab is connected to the notification stream right now; polling slows down while it is
let connected = false
const listeners = new Set<() => void>()

export function setLiveConnected(value: boolean) {
  if (connected === value) return
  connected = value
  listeners.forEach((listener) => listener())
}

export function useLiveConnected(): boolean {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => connected)
}
