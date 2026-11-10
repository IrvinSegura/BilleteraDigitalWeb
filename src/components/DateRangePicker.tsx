import { Popover } from '@base-ui/react/popover'
import { ArrowRight, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatCalendarDate, formatCalendarRange, formatLongCalendarDate, formatMonth, weekdays } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Calendar days `yyyy-MM-dd`, both included. */
export interface DateRange {
  from: string
  to: string
}

export interface DateRangePreset {
  label: string
  range: DateRange
}

const DAY_MS = 86_400_000

const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const fromDate = (date: Date) => date.toISOString().slice(0, 10)

export function addDays(day: string, by: number): string {
  return fromDate(new Date(toDate(day).getTime() + by * DAY_MS))
}

function addMonths(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number)
  return fromDate(new Date(Date.UTC(year!, number! - 1 + by, 1))).slice(0, 7)
}

/** The same day in another month, or its last day when that month is shorter. */
function sameDayIn(day: string, by: number): string {
  const month = addMonths(day.slice(0, 7), by)
  const last = addDays(`${addMonths(month, 1)}-01`, -1)
  const wanted = `${month}-${day.slice(8)}`
  return wanted > last ? last : wanted
}

export function countDays(range: DateRange): number {
  return Math.round((toDate(range.to).getTime() - toDate(range.from).getTime()) / DAY_MS) + 1
}

function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear! - fromYear!) * 12 + toMonth! - fromMonth!
}

const clamp = (day: string, min: string | undefined, max: string) => (min && day < min ? min : day > max ? max : day)

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const WIDE = '(min-width: 640px)'

// Two months side by side where they fit, one on a phone
function useWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const query = window.matchMedia(WIDE)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches,
  )
}

/** The weeks of a month, Sunday first, with `null` for the days of the months around it. */
function weeksOf(month: string): (string | null)[][] {
  const first = `${month}-01`
  const days = countDays({ from: first, to: addDays(`${addMonths(month, 1)}-01`, -1) })
  const cells: (string | null)[] = [...Array<null>(toDate(first).getUTCDay()).fill(null)]
  for (let i = 0; i < days; i++) cells.push(addDays(first, i))
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

interface Draft {
  from: string
  // Unset while the user picks the end
  to: string | null
}

function Panel({ value, min, max, maxDays, presets, label, onApply, onCancel }: {
  value: DateRange
  min: string | undefined
  max: string
  maxDays: number
  presets: DateRangePreset[]
  label: string
  onApply: (range: DateRange) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const wide = useWide()
  const minMonth = min?.slice(0, 7)
  const maxMonth = max.slice(0, 7)
  // Only months with days to pick: a history that starts this month shows this month alone
  const shown = Math.min(wide ? 2 : 1, minMonth ? monthsBetween(minMonth, maxMonth) + 1 : 2)
  // The last month in view (the one before it shows too when two fit), never past today's nor before the first one
  const fit = (month: string) => {
    const latest = month > maxMonth ? maxMonth : month
    const earliest = minMonth ? addMonths(minMonth, shown - 1) : latest
    return latest < earliest ? earliest : latest
  }
  // A whole month can reach past today or before the first day; on the calendar it starts as the days there are
  const [draft, setDraft] = useState<Draft>(() => ({ from: clamp(value.from, min, max), to: clamp(value.to, min, max) }))
  const [picked, setView] = useState(value.to.slice(0, 7))
  const view = fit(picked)
  const [focused, setFocused] = useState(() => clamp(value.to, min, max))
  const [hovered, setHovered] = useState<string | null>(null)
  const moved = useRef(false)
  const grids = useRef<HTMLDivElement>(null)

  const months = Array.from({ length: shown }, (_, i) => addMonths(view, i - shown + 1))
  const picking = draft.to === null
  // While the end is picked, a statement can't run longer than maxDays from the start
  const last = picking ? (addDays(draft.from, maxDays - 1) < max ? addDays(draft.from, maxDays - 1) : max) : max
  const unavailable = (day: string) => (min !== undefined && day < min) || day > last
  const preview = picking ? (hovered && hovered >= draft.from && !unavailable(hovered) ? hovered : null) : null
  const end = draft.to ?? preview
  const complete = draft.to !== null

  // Keyboard moves take the focus along to the day they land on
  useEffect(() => {
    if (moved.current) {
      moved.current = false
      grids.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
    }
  }, [focused, view])

  function show(day: string) {
    const month = day.slice(0, 7)
    if (month > view) setView(month)
    else if (month < months[0]!) setView(addMonths(month, shown - 1))
  }

  function pick(day: string) {
    if (unavailable(day)) return
    setFocused(day)
    if (!picking || day < draft.from) {
      setDraft({ from: day, to: null })
    } else {
      setDraft({ from: draft.from, to: day })
    }
  }

  function choose(preset: DateRangePreset) {
    setDraft(preset.range)
    setFocused(preset.range.to)
    setView(preset.range.to.slice(0, 7))
  }

  function navigate(by: number) {
    const next = addMonths(view, by)
    setView(next)
    // The focus stays on a day in view, the same one where it can
    const target = clamp(sameDayIn(focused, by), min, max)
    setFocused(target)
  }

  function onKeyDown(event: KeyboardEvent) {
    const day = (event.target as HTMLElement).dataset.date
    if (!day) return
    const weekday = toDate(day).getUTCDay()
    const target = {
      ArrowLeft: addDays(day, -1),
      ArrowRight: addDays(day, 1),
      ArrowUp: addDays(day, -7),
      ArrowDown: addDays(day, 7),
      Home: addDays(day, -weekday),
      End: addDays(day, 6 - weekday),
      PageUp: sameDayIn(day, -1),
      PageDown: sameDayIn(day, 1),
    }[event.key]
    if (!target) return
    event.preventDefault()
    const next = clamp(target, min, max)
    moved.current = true
    setFocused(next)
    show(next)
    if (picking) setHovered(next)
  }

  const isSame = (range: DateRange) => complete && draft.from === range.from && draft.to === range.to
  const status = picking ? t('dateRange.pickEnd', { days: maxDays }) : t('dateRange.pickStart')

  return (
    <>
      <Popover.Title className="sr-only">{label}</Popover.Title>
      <div className={cn('flex flex-col sm:flex-row', shown === 2 ? 'sm:w-[48rem]' : 'sm:w-[32rem]')}>
        {presets.length > 0 && (
          <div className="border-b sm:w-44 sm:shrink-0 sm:border-r sm:border-b-0">
            <p className="hidden px-4 pt-4 pb-2 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase sm:block">
              {t('dateRange.shortcuts')}
            </p>
            <div className="scrollbar-thin flex gap-1.5 overflow-x-auto p-3 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:px-2 sm:pt-0">
              {presets.map((preset) => (
                <button key={preset.label} type="button" onClick={() => choose(preset)} aria-pressed={isSame(preset.range)}
                  className={cn('shrink-0 rounded-full border px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors sm:rounded-lg sm:border-transparent sm:px-2.5',
                    isSame(preset.range)
                      ? 'border-primary/30 bg-primary/10 font-medium text-primary'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground')}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div ref={grids} className={cn('grid gap-6', shown === 2 && 'grid-cols-2')} onKeyDown={onKeyDown} onMouseLeave={() => setHovered(null)}>
            {months.map((month, index) => (
              <div key={month}>
                <div className="relative mb-2 flex h-8 items-center justify-center">
                  {index === 0 && (
                    <Button variant="ghost" size="icon-sm" className="absolute left-0" aria-label={t('dateRange.previousMonth')}
                      disabled={!!minMonth && months[0]! <= minMonth} onClick={() => navigate(-1)}>
                      <ChevronLeft />
                    </Button>
                  )}
                  <p className="text-sm font-semibold" aria-live="polite">{capitalized(formatMonth(month))}</p>
                  {index === months.length - 1 && (
                    <Button variant="ghost" size="icon-sm" className="absolute right-0" aria-label={t('dateRange.nextMonth')}
                      disabled={view >= maxMonth} onClick={() => navigate(1)}>
                      <ChevronRight />
                    </Button>
                  )}
                </div>
                <MonthGrid month={month} draft={draft} end={end} focused={focused} today={max} unavailable={unavailable}
                  onPick={pick} onHover={(day) => picking && setHovered(day)} onFocusDay={setFocused} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {status}
            {min && <> · {t('dateRange.since', { date: formatCalendarDate(min) })}</>}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t bg-muted/30 p-3 sm:flex-row sm:items-center sm:px-4">
        <div className="flex items-center gap-2">
          <End label={t('dateRange.from')} date={draft.from} active={complete} />
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          <End label={t('dateRange.to')} date={draft.to} active={picking} />
          {complete && (
            <span className="ml-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium whitespace-nowrap text-primary tabular">
              {t('dateRange.days', { count: countDays({ from: draft.from, to: draft.to! }) })}
            </span>
          )}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button className="flex-1 sm:flex-none" disabled={!complete} onClick={() => onApply({ from: draft.from, to: draft.to! })}>
            {t('dateRange.apply')}
          </Button>
        </div>
      </div>
    </>
  )
}

/** One end of the range in the footer; the one being picked stands out. */
function End({ label, date, active }: { label: string; date: string | null; active: boolean }) {
  return (
    <div className={cn('min-w-0 flex-1 rounded-lg border bg-background px-2.5 py-1.5 transition-colors sm:w-32 sm:flex-none',
      active && 'border-primary ring-3 ring-primary/20')}>
      <p className="text-[0.7rem] leading-tight text-muted-foreground">{label}</p>
      <p className={cn('truncate text-sm font-medium tabular', !date && 'text-muted-foreground')}>{date ? formatCalendarDate(date) : '—'}</p>
    </div>
  )
}

function MonthGrid({ month, draft, end, focused, today, unavailable, onPick, onHover, onFocusDay }: {
  month: string
  draft: Draft
  end: string | null
  focused: string
  today: string
  unavailable: (day: string) => boolean
  onPick: (day: string) => void
  onHover: (day: string) => void
  onFocusDay: (day: string) => void
}) {
  const names = weekdays()
  const weeks = weeksOf(month)
  // The day that takes the tab stop: the focused one when it is in this month, else none here
  const tabStop = focused.slice(0, 7) === month ? focused : null
  return (
    <div role="grid" aria-label={capitalized(formatMonth(month))} className="grid gap-y-1">
      <div role="row" className="grid grid-cols-7">
        {names.map((name) => (
          <span key={name.long} role="columnheader" aria-label={name.long}
            className="flex h-7 items-center justify-center text-[0.7rem] font-medium text-muted-foreground">
            {name.short}
          </span>
        ))}
      </div>
      {weeks.map((week, row) => (
        <div key={row} role="row" className="grid grid-cols-7">
          {week.map((day, column) => {
            if (!day) return <span key={column} role="gridcell" />
            const isStart = day === draft.from
            const isEnd = day === end
            const inRange = end !== null && day >= draft.from && day <= end
            const span = end !== null && end !== draft.from
            const blocked = unavailable(day)
            const firstOfMonth = day.endsWith('-01')
            const lastOfMonth = addDays(day, 1).endsWith('-01')
            return (
              <div key={day} role="gridcell" aria-selected={inRange}
                className={cn('flex h-9 items-center justify-center',
                  // The band behind the days in the range, with round ends at the edges of a week or month
                  inRange && span && !isStart && !isEnd && 'bg-primary/10',
                  span && isStart && 'bg-linear-to-r from-transparent from-50% to-primary/10 to-50%',
                  span && isEnd && 'bg-linear-to-l from-transparent from-50% to-primary/10 to-50%',
                  inRange && !isStart && (column === 0 || firstOfMonth) && 'rounded-l-lg',
                  inRange && !isEnd && (column === 6 || lastOfMonth) && 'rounded-r-lg')}>
                <button type="button" data-date={day} tabIndex={day === tabStop ? 0 : -1}
                  aria-label={formatLongCalendarDate(day)} aria-disabled={blocked || undefined}
                  aria-current={day === today ? 'date' : undefined}
                  onClick={() => onPick(day)} onMouseEnter={() => onHover(day)} onFocus={() => onFocusDay(day)}
                  className={cn('relative flex size-9 items-center justify-center rounded-lg text-sm tabular transition-colors outline-none',
                    'focus-visible:ring-3 focus-visible:ring-ring/50',
                    blocked ? 'cursor-not-allowed text-muted-foreground/35'
                      : isStart || isEnd ? 'bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/30'
                        : inRange ? 'text-foreground hover:bg-primary/15'
                          : 'hover:bg-muted',
                    day === today && 'after:absolute after:bottom-1 after:size-1 after:rounded-full',
                    day === today && (isStart || isEnd ? 'after:bg-primary-foreground' : 'after:bg-primary'))}>
                  {Number(day.slice(8))}
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Picks a span of days on a calendar: two months side by side (one on a phone), shortcuts beside them, and nothing
 * outside `min`–`max` or longer than `maxDays`. The choice only counts once applied; closing it any other way keeps
 * the range there was. Arrows, Home/End and PageUp/PageDown move between days.
 */
export function DateRangePicker({ value, onChange, min, max, maxDays, presets = [], open, onOpenChange, label, className }: {
  value: DateRange
  onChange: (range: DateRange) => void
  min?: string
  max: string
  maxDays: number
  presets?: DateRangePreset[]
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const text = formatCalendarRange(value.from, value.to)
  return (
    <Popover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Popover.Trigger aria-label={`${label}: ${text}`}
        className={cn('flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none select-none',
          'hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30 dark:bg-input/30 dark:hover:bg-input/50',
          className)}>
        <CalendarRange className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-left font-medium tabular">{text}</span>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular">
          {t('dateRange.days', { count: countDays(value) })}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" side="bottom" align="end" sideOffset={8} collisionPadding={16}>
          <Popover.Popup
            initialFocus={() => document.querySelector<HTMLElement>('[data-slot="date-range"] [data-date][tabindex="0"]')}
            data-slot="date-range"
            className="w-[calc(100vw-2rem)] max-w-max origin-(--transform-origin) overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Panel value={value} min={min} max={max} maxDays={maxDays} presets={presets} label={label}
              onApply={(range) => { onChange(range); onOpenChange(false) }} onCancel={() => onOpenChange(false)} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
