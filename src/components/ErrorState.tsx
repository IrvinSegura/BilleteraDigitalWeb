import { CircleAlert, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** A failed query, with a retry when there is something to retry. */
export function ErrorState({ error, onRetry, className }: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

/** An error under a form, above its buttons. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) {
    return null
  }
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
