import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/** Placeholder rows for a list while it loads, shaped like ActivityRow. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useTranslation()
  return (
    <div className="divide-y" role="status" aria-busy aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
