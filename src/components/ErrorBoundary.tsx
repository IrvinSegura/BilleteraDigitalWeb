import { CircleAlert, House, RefreshCw, RotateCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'

import { Button, buttonVariants } from '@/components/ui/button'
import { isChunkLoadError, reloadForNewRelease } from '@/lib/chunk-reload'
import { reportError } from '@/lib/monitoring'
import { cn } from '@/lib/utils'

interface FallbackProps {
  error: unknown
  reset: () => void
}

interface Props {
  fallback: (props: FallbackProps) => ReactNode
  /** Names the boundary in error reports. */
  scope: string
  /** A caught error is cleared when this changes, e.g. the page's path: going elsewhere leaves it behind. */
  resetKey?: unknown
  children: ReactNode
}

interface State {
  caught: boolean
  error: unknown
  resetKey: unknown
}

/**
 * Shows fallback instead of a blank screen when something below fails to render, and reports it. A screen
 * chunk that is gone after a release reloads the page once instead. Errors in event handlers and async code
 * don't reach a boundary; the monitoring SDK catches those.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { caught: false, error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { caught: true, error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { caught: false, error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadForNewRelease()) {
      return
    }
    reportError(error, { boundary: this.props.scope, chunk: String(isChunkLoadError(error)) })
    if (import.meta.env.DEV) {
      console.error(info.componentStack)
    }
  }

  reset = () => {
    this.setState({ caught: false, error: null })
  }

  render() {
    return this.state.caught ? this.props.fallback({ error: this.state.error, reset: this.reset }) : this.props.children
  }
}

function CrashMessage({ error, reset, home, className }: FallbackProps & { home: ReactNode; className?: string }) {
  const { t } = useTranslation()
  // A screen that couldn't be downloaded won't load by rendering it again: React keeps the failed import
  const outdated = isChunkLoadError(error)
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-5 px-6 text-center', className)}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="max-w-sm space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t(outdated ? 'crash.outdatedTitle' : 'crash.title')}
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          {t(outdated ? 'crash.outdatedHint' : 'crash.hint')}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {outdated ? (
          <Button onClick={() => window.location.reload()}><RefreshCw /> {t('crash.reload')}</Button>
        ) : (
          <Button onClick={reset}><RotateCw /> {t('common.retry')}</Button>
        )}
        {home}
      </div>
    </div>
  )
}

/** The last line of defence, around the whole app: it can't count on the router or the session. */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <ErrorBoundary
      scope="app"
      fallback={(props) => (
        <CrashMessage {...props} className="min-h-svh"
          home={<Button variant="outline" onClick={() => window.location.assign('/')}><House /> {t('common.goHome')}</Button>} />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

/** Around a layout's page: the navigation stays usable, and going to another page clears the error. */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <ErrorBoundary
      scope="page"
      resetKey={pathname}
      fallback={(props) => (
        <CrashMessage {...props} className="py-16"
          home={pathname !== '/' && (
            <Link to="/" className={buttonVariants({ variant: 'outline' })}><House /> {t('common.goHome')}</Link>
          )} />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
