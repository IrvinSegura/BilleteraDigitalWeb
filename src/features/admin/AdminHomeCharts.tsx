import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatCalendarDay, formatCompact, formatCount, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

import { OPERATION_KINDS, type OperationKind, type SignupPoint, totalsOf, type VolumePoint } from './home-series'

// Validated together for color blindness and contrast, in this order, in both themes
const KIND_COLOR: Record<OperationKind, string> = {
  deposit: 'var(--chart-2)',
  transfer: 'var(--chart-1)',
  withdrawal: 'var(--chart-3)',
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
}

function ChartEmpty({ children }: { children: string }) {
  return <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">{children}</div>
}

/** How much money moved each day, one column per day stacked by kind of operation. */
export function VolumeChart({ data, currency }: { data: VolumePoint[]; currency: string }) {
  const { t } = useTranslation()
  const money = (amount: number) => formatMoney({ amount: String(amount), currency })
  const totals = totalsOf(data)
  const withActivity = data.filter((point) => point.operations > 0)

  return (
    <div className="grid gap-4">
      <ul className="grid gap-x-6 gap-y-2 border-b pb-4 sm:grid-cols-3" aria-label={t('admin.home.volumeLegend')}>
        {OPERATION_KINDS.map((kind) => (
          <li key={kind} className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Swatch color={KIND_COLOR[kind]} /> {t(`admin.home.kinds.${kind}`)}
            </span>
            <span className="block truncate text-lg font-semibold tracking-tight tabular">{money(totals[kind])}</span>
          </li>
        ))}
      </ul>
      {withActivity.length === 0 ? <ChartEmpty>{t('admin.home.volumeEmpty', { currency })}</ChartEmpty> : (
        <>
          <div className="h-72 w-full" role="img" aria-label={t('admin.home.volumeLabel', { currency })}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={(date: string) => formatCalendarDay(date)} tick={AXIS_TICK}
                  tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis width={48} tickFormatter={(value: number) => formatCompact(value)} tick={AXIS_TICK}
                  tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as VolumePoint | undefined
                  if (!active || !point) return null
                  return (
                    <div className="grid gap-1 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="text-muted-foreground">{formatCalendarDay(point.date)}</p>
                      {OPERATION_KINDS.map((kind) => (
                        <p key={kind} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5"><Swatch color={KIND_COLOR[kind]} /> {t(`admin.home.kinds.${kind}`)}</span>
                          <span className="font-semibold tabular">{money(point[kind])}</span>
                        </p>
                      ))}
                      <p className="text-muted-foreground">{t('admin.home.operationsOfDay', { count: point.operations })}</p>
                    </div>
                  )
                }} />
                {OPERATION_KINDS.map((kind, index) => (
                  <Bar key={kind} dataKey={kind} stackId="money" fill={KIND_COLOR[kind]} stroke="var(--card)" strokeWidth={2}
                    maxBarSize={24} isAnimationActive={false}
                    radius={index === OPERATION_KINDS.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{t('admin.home.volumeLabel', { currency })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('common.date')}</th>
                {OPERATION_KINDS.map((kind) => <th key={kind} scope="col">{t(`admin.home.kinds.${kind}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {withActivity.map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatCalendarDay(point.date)}</th>
                  {OPERATION_KINDS.map((kind) => <td key={kind}>{money(point[kind])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

/** How many customers signed up each day. */
export function SignupsChart({ data }: { data: SignupPoint[] }) {
  const { t } = useTranslation()
  const withSignups = data.filter((point) => point.count > 0)
  if (withSignups.length === 0) return <ChartEmpty>{t('admin.home.signupsEmpty')}</ChartEmpty>
  return (
    <>
      <div className="h-56 w-full" role="img" aria-label={t('admin.home.signupsLabel')}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={(date: string) => formatCalendarDay(date)} tick={AXIS_TICK}
              tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis width={32} allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={({ active, payload }) => {
              const point = payload?.[0]?.payload as SignupPoint | undefined
              if (!active || !point) return null
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground">{formatCalendarDay(point.date)}</p>
                  <p className="font-semibold tabular">{t('admin.home.signupsOfDay', { count: point.count })}</p>
                </div>
              )
            }} />
            <Bar dataKey="count" fill="var(--chart-1)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t('admin.home.signupsLabel')}</caption>
        <tbody>
          {withSignups.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatCalendarDay(point.date)}</th>
              <td>{formatCount(point.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export interface BarSegment {
  label: string
  value: number
  /** A Tailwind background class: these are states, so they use the status colors. */
  className: string
}

/** A whole split into its states: one bar with a gap between the parts, and a legend that says each one. */
export function StatusBar({ label, segments }: { label: string; segments: BarSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return (
    <div className="grid gap-2">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="font-semibold tabular">{formatCount(total)}</span>
      </p>
      <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {total > 0 && segments.filter((segment) => segment.value > 0).map((segment) => (
          <span key={segment.label} className={cn('h-full min-w-1', segment.className)} style={{ flexGrow: segment.value }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-2 rounded-full', segment.className)} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-medium tabular">{formatCount(segment.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
