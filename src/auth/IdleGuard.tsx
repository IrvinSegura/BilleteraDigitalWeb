import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { useAuth } from './auth-context'

// A money app shouldn't stay open on an unattended screen: after this long without activity in any tab the user
// is warned, and WARNING later signed out
const IDLE_LIMIT_MS = 10 * 60_000
const WARNING_MS = 60_000
// Writing the shared timestamp on every mouse move would be wasteful; once in this window is enough
const WRITE_EVERY_MS = 10_000

// Shared by every tab, so working in one keeps the others signed in too
const LAST_ACTIVITY_KEY = 'wallet.lastActivity'
const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

let fallbackLastActivity = Date.now()

function readLastActivity(): number {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
    return Number.isFinite(value) && value > 0 ? Math.max(value, fallbackLastActivity) : fallbackLastActivity
  } catch {
    return fallbackLastActivity
  }
}

function markActivity() {
  fallbackLastActivity = Date.now()
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(fallbackLastActivity))
  } catch {
    // Storage blocked: this tab still keeps its own clock
  }
}

/** Warns before signing out an idle user, and signs them out when the time is up. */
export function IdleGuard() {
  const { t, i18n } = useTranslation()
  const { logout } = useAuth()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    markActivity()
    let lastWrite = Date.now()
    const onActivity = () => {
      if (Date.now() - lastWrite >= WRITE_EVERY_MS) {
        lastWrite = Date.now()
        markActivity()
      }
    }

    // Background tabs run timers late, and a sleeping computer not at all: every check works from the clock, and
    // one runs as soon as the tab is shown again
    const check = () => {
      const idle = Date.now() - readLastActivity()
      if (idle >= IDLE_LIMIT_MS) {
        setSecondsLeft(null)
        toast.info(i18n.t('session.idleSignedOut'))
        void logout()
      } else if (idle >= IDLE_LIMIT_MS - WARNING_MS) {
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS - idle) / 1000))
      } else {
        setSecondsLeft(null)
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && check()

    for (const event of activityEvents) {
      window.addEventListener(event, onActivity, { passive: true, capture: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, 1000)
    return () => {
      for (const event of activityEvents) {
        window.removeEventListener(event, onActivity, { capture: true })
      }
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [logout, i18n])

  const stay = () => {
    markActivity()
    setSecondsLeft(null)
  }

  return (
    // Closing the warning in any way counts as being there
    <Dialog open={secondsLeft !== null} onOpenChange={(open) => !open && stay()}>
      <DialogContent className="p-6 sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning-foreground dark:text-warning">
            <Clock className="size-6" />
          </span>
          <DialogTitle>{t('session.idleTitle')}</DialogTitle>
          <DialogDescription>
            <Trans
              i18nKey="session.idleWarning"
              values={{ seconds: secondsLeft }}
              components={{ time: <span className="font-semibold text-foreground tabular" aria-live="polite" /> }}
            />
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-row">
          <Button variant="outline" className="sm:flex-1" onClick={() => void logout()}>{t('common.signOut')}</Button>
          <Button className="sm:flex-1" autoFocus onClick={stay}>{t('session.stay')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
