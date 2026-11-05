import { useTranslation } from 'react-i18next'

import { type StatusStyle, type Tone, toneClasses } from '@/lib/labels'
import { cn } from '@/lib/utils'

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-primary',
}

/** A status pill; unknown values show as they come, in neutral. */
export function StatusBadge({ value, map, className }: {
  value: string | undefined
  map: Record<string, StatusStyle>
  className?: string
}) {
  const { t } = useTranslation()
  const style = value ? map[value] : undefined
  const tone = style?.tone ?? 'neutral'
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
      toneClasses[tone], className)}>
      <span className={cn('size-1.5 rounded-full', dotClasses[tone])} />
      {style ? t(style.labelKey) : (value ?? '—')}
    </span>
  )
}
