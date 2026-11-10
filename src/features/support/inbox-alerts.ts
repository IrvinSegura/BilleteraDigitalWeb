import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'support.inbox.alerts'

/** How the agent wants to be told, kept in this browser only. */
export interface AlertPrefs {
  sound: boolean
  desktop: boolean
}

const DEFAULT_PREFS: AlertPrefs = { sound: true, desktop: false }

function readPrefs(): AlertPrefs {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...DEFAULT_PREFS, ...(JSON.parse(saved) as Partial<AlertPrefs>) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function useAlertPrefs() {
  const [prefs, setPrefs] = useState(readPrefs)
  const update = useCallback((next: Partial<AlertPrefs>) => {
    setPrefs((previous) => {
      const merged = { ...previous, ...next }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // Private windows may refuse it: the choice then lasts until the page closes
      }
      return merged
    })
  }, [])
  return [prefs, update] as const
}

/** Whether the browser can show notifications, and whether the agent allowed them. */
export function desktopPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

// A short, soft tone made on the spot: no sound file to load
function chime() {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.08, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)
    oscillator.connect(gain).connect(context.destination)
    oscillator.onended = () => void context.close()
    oscillator.start()
    oscillator.stop(context.currentTime + 0.35)
  } catch {
    // Some browsers refuse sound until the page was used; the other alerts still go out
  }
}

export interface InboxAlert {
  kind: 'case' | 'message'
  caseId: string
}

/**
 * Watches the agent's summary and tells them when a case comes to them or its customer writes: with a toast while
 * they look at the page, and with a count in the tab's title, a tone and, if allowed, a browser notification while
 * they don't. A message in the case on screen with the page in view needs no alert: they are reading it.
 *
 * @param loaded  whether the summary was read at least once; the first read is where things stand, not news
 * @param viewing the case the agent has open, if any
 */
export function useInboxAlerts({ loaded, activeCaseId, lastCustomerMessageAt, viewing, prefs, onAlert }: {
  loaded: boolean
  activeCaseId: string | undefined
  lastCustomerMessageAt: string | undefined
  viewing: string | undefined
  prefs: AlertPrefs
  onAlert: (alert: InboxAlert, hidden: boolean) => { title: string; body: string } | void
}) {
  const seen = useRef<{ caseId?: string; lastAt?: string } | null>(null)
  const [unseen, setUnseen] = useState(0)
  const latest = useRef({ viewing, prefs, onAlert })
  // Declared first, so the effect below reads what this render passed
  useEffect(() => {
    latest.current = { viewing, prefs, onAlert }
  })

  useEffect(() => {
    if (!loaded) return
    const previous = seen.current
    seen.current = { caseId: activeCaseId, lastAt: lastCustomerMessageAt }
    if (!previous || !activeCaseId) return
    const hidden = document.hidden
    let alert: InboxAlert | null = null
    if (activeCaseId !== previous.caseId) {
      alert = { kind: 'case', caseId: activeCaseId }
    } else if (lastCustomerMessageAt && lastCustomerMessageAt !== previous.lastAt
      && (hidden || latest.current.viewing !== activeCaseId)) {
      alert = { kind: 'message', caseId: activeCaseId }
    }
    if (!alert) return
    const { prefs: current, onAlert: show } = latest.current
    const text = show(alert, hidden)
    if (current.sound) chime()
    if (hidden) {
      setUnseen((count) => count + 1)
      if (text && current.desktop && desktopPermission() === 'granted') {
        try {
          new Notification(text.title, { body: text.body, tag: `support-${alert.kind}-${alert.caseId}` })
        } catch {
          // Mobile browsers only notify from a service worker; the title still counts it
        }
      }
    }
  }, [loaded, activeCaseId, lastCustomerMessageAt])

  // Looking at the page again is having seen it
  useEffect(() => {
    const reset = () => {
      if (!document.hidden) setUnseen(0)
    }
    document.addEventListener('visibilitychange', reset)
    return () => document.removeEventListener('visibilitychange', reset)
  }, [])

  useEffect(() => {
    if (unseen === 0) return
    const title = document.title
    document.title = `(${unseen}) ${title}`
    return () => {
      document.title = title
    }
  }, [unseen])

  return unseen
}
