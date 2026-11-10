import { ArrowDownRight, ArrowUpRight, ChevronRight, CircleCheck, CircleX, type LucideIcon, Minus, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Skeleton } from '@/components/Skeleton'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { Change } from './home-series'

/** Cells of one surface, with a hairline between them however they wrap. */
export const BAND = 'grid gap-px overflow-clip rounded-xl bg-foreground/10 ring-1 ring-foreground/10'

const SPARK_WIDTH = 96
const SPARK_HEIGHT = 36
const SPARK_INSET = 3

/** The shape of a figure over the period, beside the figure itself: its numbers are in the charts and their tables. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const x = (index: number) => SPARK_INSET + (index * (SPARK_WIDTH - 2 * SPARK_INSET)) / (values.length - 1)
  const y = (value: number) => SPARK_HEIGHT - SPARK_INSET - (max > 0 ? (value / max) * (SPARK_HEIGHT - 2 * SPARK_INSET) : 0)
  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const floor = SPARK_HEIGHT - SPARK_INSET
  return (
    <svg aria-hidden viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} width={SPARK_WIDTH} height={SPARK_HEIGHT} className="shrink-0 text-chart-1">
      <polygon points={`${x(0)},${floor} ${line} ${x(values.length - 1)},${floor}`} fill="currentColor" opacity={0.1} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1) ?? 0)} r={3} fill="currentColor" stroke="var(--card)" strokeWidth={1.5} />
    </svg>
  )
}

const TREND_ICON: Record<'up' | 'down' | 'flat', LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus }
const TREND_COLOR: Record<'up' | 'down' | 'flat', string> = { up: 'text-success', down: 'text-destructive', flat: 'text-muted-foreground' }

/** How a figure compares with the period before: said with an arrow and a sign too, never by its color alone. */
export function ChangeNote({ change, days }: { change: Change; days: number }) {
  const { t } = useTranslation()
  if (change.trend === 'new') return <>{t('admin.home.changeNew')}</>
  const Icon = TREND_ICON[change.trend]
  return (
    <>
      <span className={cn('inline-flex items-center gap-0.5 font-medium', TREND_COLOR[change.trend])}>
        <Icon className="size-3.5" />
        {change.trend === 'flat' ? t('admin.home.changeFlat') : `${change.trend === 'up' ? '+' : '−'}${change.percent}%`}
      </span>
      {' '}{t('admin.home.changeAgainst', { days })}
    </>
  )
}

/** One headline figure. Goes inside a `<dl>`. */
export function Kpi({ label, loading, children, foot, trend }: {
  label: string
  loading: boolean
  children: ReactNode
  foot?: ReactNode
  trend?: number[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 bg-card p-5">
      <div className="flex min-h-9 items-start justify-between gap-3">
        <dt className="min-w-0 truncate text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{label}</dt>
        {trend && !loading && <dd><Sparkline values={trend} /></dd>}
      </div>
      <div className="mt-auto">
        <dd className="truncate text-2xl leading-tight font-semibold tracking-tight tabular 2xl:text-[1.75rem]">
          {loading ? <Skeleton className="h-8 w-32" /> : children}
        </dd>
        <dd className="mt-1.5 min-h-4 text-xs text-pretty text-muted-foreground">
          {loading ? <Skeleton className="h-3.5 w-28" /> : foot}
        </dd>
      </div>
    </div>
  )
}

/** One thing that waits for someone, how many there are, and the way to them. */
export function AttentionCell({ to, icon: Icon, title, hint, count, loading }: {
  to: string
  icon: LucideIcon
  title: string
  hint: string
  count: number | undefined
  loading: boolean
}) {
  const waiting = !!count
  return (
    <Link to={to} className="group flex items-start gap-3 bg-card p-5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg',
        waiting ? 'bg-warning/15 text-warning-foreground dark:text-warning' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          {title}
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </span>
        <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">{hint}</span>
      </span>
      {loading ? <Skeleton className="h-8 w-8" /> : (
        <span className={cn('text-2xl leading-none font-semibold tracking-tight tabular', !waiting && 'text-muted-foreground')}>
          {count === undefined ? '—' : formatCount(count)}
        </span>
      )}
    </Link>
  )
}

export type Tone = 'good' | 'warning' | 'danger'

const TONE_ICON: Record<Tone, LucideIcon> = { good: CircleCheck, warning: TriangleAlert, danger: CircleX }
const TONE_COLOR: Record<Tone, string> = {
  good: 'text-success',
  warning: 'text-warning-foreground dark:text-warning',
  danger: 'text-destructive',
}

/** One thing that should be working, what it says now, and the way to it. */
export function HealthRow({ to, icon: Icon, title, tone, status, detail, loading }: {
  to: string
  icon: LucideIcon
  title: string
  tone: Tone | undefined
  status: string
  detail?: string
  loading: boolean
}) {
  const ToneIcon = tone && TONE_ICON[tone]
  return (
    <li>
      <Link to={to} className="group flex h-full items-center gap-3 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium group-hover:underline">{title}</span>
          {loading ? <Skeleton className="mt-1 h-3.5 w-28" /> : (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {ToneIcon && <ToneIcon className={cn('size-3.5', tone && TONE_COLOR[tone])} />}
              <span>{status}</span>
              {detail && <span>· {detail}</span>}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}

/** The verdict of a whole card, in its corner. */
export function HealthVerdict({ issues }: { issues: number }) {
  const { t } = useTranslation()
  const Icon = issues ? TriangleAlert : CircleCheck
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      issues ? 'bg-warning/15 text-warning-foreground dark:text-warning' : 'bg-success/12 text-success')}>
      <Icon className="size-3.5" />
      {issues ? t('admin.home.healthReview', { count: issues }) : t('admin.home.healthAllGood')}
    </span>
  )
}

/** Figures of the same kind, one per line. */
export function FigureList({ rows }: { rows: { label: string; value: number | undefined }[] }) {
  return (
    <dl className="divide-y">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <dt className="min-w-0 truncate text-sm text-muted-foreground">{row.label}</dt>
          <dd className="text-sm font-semibold tabular">{row.value === undefined ? '—' : formatCount(row.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
