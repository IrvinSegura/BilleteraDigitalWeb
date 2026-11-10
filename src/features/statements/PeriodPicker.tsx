import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { addDays, type DateRangePreset, DateRangePicker } from '@/components/DateRangePicker'
import { Select } from '@/components/ui/select'

import { lastDay, MAX_PERIOD_DAYS, monthPeriod, type Period, shiftMonth } from './statement-data'

const LAST_MONTH = 'lastMonth'
const LAST_THREE = 'last3'
const CUSTOM = 'custom'

/** The last three months together: from the first day of the month two months back, to today. */
export function lastThreeMonths(today: string, first: string | undefined): Period {
  const from = `${shiftMonth(today.slice(0, 7), -2)}-01`
  return { from: first && first > from ? first : from, to: today }
}

const samePeriod = (a: Period, b: Period) => a.from === b.from && a.to === b.to

type Shortcut = 'previousMonth' | 'last7' | 'last30' | 'last90' | 'thisYear' | 'sinceFirst'

/**
 * Quick picks on the calendar, kept within the user's history. One that would reach before it becomes "all your
 * history", once; one that ends before it is left out.
 */
function shortcuts(today: string, first: string | undefined, label: (key: Shortcut) => string): DateRangePreset[] {
  const previous = shiftMonth(today.slice(0, 7), -1)
  const candidates: [Shortcut, Period][] = [
    ['previousMonth', { from: `${previous}-01`, to: lastDay(previous) }],
    ['last7', { from: addDays(today, -6), to: today }],
    ['last30', { from: addDays(today, -29), to: today }],
    ['last90', { from: addDays(today, -89), to: today }],
    ['thisYear', { from: `${today.slice(0, 4)}-01-01`, to: today }],
  ]
  const presets: DateRangePreset[] = []
  for (const [key, period] of candidates) {
    if (first && period.to < first) continue
    const cut = !!first && period.from < first
    const range = cut ? { from: first!, to: period.to } : period
    if (!presets.some((preset) => samePeriod(preset.range, range))) {
      presets.push({ label: label(cut ? 'sinceFirst' : key), range })
    }
  }
  return presets
}

/**
 * Picks a statement's period: the current month, the last three months, or any days on a calendar. Nothing before
 * the user's first record or after today can be picked, nor more days than a statement covers.
 *
 * @param first the first day with something of the user (their oldest wallet), when known
 */
export function PeriodPicker({ period, onChange, first, today }: {
  period: Period
  onChange: (period: Period) => void
  first: string | undefined
  today: string
}) {
  const { t } = useTranslation()
  const lastMonth = monthPeriod(today.slice(0, 7))
  const lastThree = lastThreeMonths(today, first)
  // With nothing before this month, the three months would be this one again
  const offerThree = !first || first < lastMonth.from
  const selected = samePeriod(period, lastMonth) ? LAST_MONTH
    : offerThree && samePeriod(period, lastThree) ? LAST_THREE : CUSTOM
  const [custom, setCustom] = useState(selected === CUSTOM)
  const [open, setOpen] = useState(false)

  const options = [
    { value: LAST_MONTH, label: t('statements.periods.lastMonth') },
    ...(offerThree ? [{ value: LAST_THREE, label: t('statements.periods.lastThree') }] : []),
    { value: CUSTOM, label: t('statements.periods.custom') },
  ]

  function choose(value: string) {
    if (value === CUSTOM) {
      setCustom(true)
      // The calendar opens right away: choosing the dates is why it was picked
      setOpen(true)
      return
    }
    setCustom(false)
    onChange(value === LAST_THREE ? lastThree : lastMonth)
  }

  const picking = custom || selected === CUSTOM
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Select value={picking ? CUSTOM : selected} onValueChange={choose} options={options}
        aria-label={t('statements.periods.label')} className="h-9 w-full sm:w-48" />
      {picking && (
        <DateRangePicker value={period} onChange={onChange} min={first} max={today} maxDays={MAX_PERIOD_DAYS}
          presets={shortcuts(today, first, (key) => t(`statements.periods.${key}`))} open={open} onOpenChange={setOpen}
          label={t('statements.periods.dates')} className="sm:w-auto" />
      )}
    </div>
  )
}
