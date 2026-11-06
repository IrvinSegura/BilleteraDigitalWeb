import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground ring-8 ring-accent/40">
        <Icon className="size-5" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
