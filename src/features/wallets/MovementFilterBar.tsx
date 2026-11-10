import { Download, FileText, Loader2, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import type { MovementFilters } from '@/api/queries'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_SUGGESTIONS, SuggestInput, useSuggestions } from '@/components/SuggestInput'
import { saveFile } from '@/lib/download'
import { formatDateTime, formatMoney } from '@/lib/format'
import { movementLabel } from '@/lib/labels'

// A withdrawal that bounced comes back as its own entry type, and belongs with withdrawals
const TYPES_OF_KIND: Record<string, string[]> = {
  DEPOSIT: ['DEPOSIT'],
  TRANSFER: ['TRANSFER'],
  WITHDRAWAL: ['WITHDRAWAL', 'WITHDRAWAL_REVERSAL'],
}

// The API's limit for one statement file
const MAX_STATEMENT_DAYS = 366
// The API's limit for the search text
const MAX_SEARCH_LENGTH = 60
// A picked suggestion leaves a whole folio in the field, which has nothing left to suggest
const WHOLE_FOLIO = /^[0-9a-f-]{36}$/i

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_TYPES = Object.values(TYPES_OF_KIND).flat()

/** The filters a link holds; anything else in it, typed or left by an older link, is ignored. */
export function filtersFrom(params: URLSearchParams): MovementFilters {
  const day = (name: string) => (CALENDAR_DAY.test(params.get(name) ?? '') ? params.get(name)! : undefined)
  const types = params.getAll('type').filter((type) => KNOWN_TYPES.includes(type))
  const direction = params.get('direction')
  return {
    ...(day('from') && { from: day('from') }),
    ...(day('to') && { to: day('to') }),
    ...(types.length > 0 && { type: types }),
    ...((direction === 'IN' || direction === 'OUT') && { direction }),
    ...(params.get('q')?.trim() && { q: params.get('q')!.trim().slice(0, MAX_SEARCH_LENGTH) }),
  }
}

/** The filters as the query of the page, so they survive going to a receipt and back, and can be shared. */
export function filtersToParams(filters: MovementFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  filters.type?.forEach((type) => params.append('type', type))
  if (filters.direction) params.set('direction', filters.direction)
  if (filters.q) params.set('q', filters.q)
  return params
}

/** Today as a calendar date in the browser's zone, `yyyy-MM-dd`. */
export function today(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function currentMonth(): string {
  return today().slice(0, 7)
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000
}

/** Kind of movement picked in the filters: the first entry type it stands for. */
function kindOf(filters: MovementFilters): string {
  return filters.type?.[0] ?? ''
}

export function countActive(filters: MovementFilters): number {
  return [filters.from, filters.to, filters.type?.length, filters.direction, filters.q].filter(Boolean).length
}

/**
 * Filters for a wallet's movements, and the statement of the period they pick (the current month by default)
 * as CSV or as a printable page. Dates go from the day the wallet was opened to today, and the end can't come before
 * the start.
 */
export function MovementFilterBar({ walletId, openedAt, filters, onChange }: {
  walletId: string
  /** When the wallet was opened: nothing happened in it before. */
  openedAt?: string
  filters: MovementFilters
  onChange: (filters: MovementFilters) => void
}) {
  const { t } = useTranslation()
  const kinds = [
    { value: '', label: t('wallets.filters.all') },
    { value: 'DEPOSIT', label: t('wallets.filters.deposits') },
    { value: 'TRANSFER', label: t('wallets.filters.transfers') },
    { value: 'WITHDRAWAL', label: t('wallets.filters.withdrawals') },
  ]
  const directions = [
    { value: '', label: t('wallets.filters.all') },
    { value: 'IN', label: t('wallets.filters.moneyIn') },
    { value: 'OUT', label: t('wallets.filters.moneyOut') },
  ]
  const [open, setOpen] = useState(() => countActive(filters) > 0)
  const [search, setSearch] = useState(filters.q ?? '')
  const [downloading, setDownloading] = useState(false)
  const invalidPeriod = !!filters.from && !!filters.to && filters.from > filters.to
  const firstDay = openedAt ? new Date(openedAt).toLocaleDateString('en-CA') : undefined

  // A date typed by hand gets the same bounds as the picker: never before the wallet existed nor after today
  function changeDate(end: 'from' | 'to', value: string) {
    let day = value || undefined
    if (day && firstDay && day < firstDay) {
      day = firstDay
    }
    if (day && day > today()) {
      day = today()
    }
    onChange({ ...filters, [end]: day })
  }

  // The search waits for a pause in typing, so each keystroke doesn't fetch a page
  useEffect(() => {
    const q = search.trim() || undefined
    if (q === filters.q) return
    const timer = setTimeout(() => onChange({ ...filters, q }), 300)
    return () => clearTimeout(timer)
  }, [search, filters, onChange])

  async function downloadCsv() {
    const monthStart = `${currentMonth()}-01`
    const from = filters.from ?? (firstDay && firstDay > monthStart ? firstDay : monthStart)
    const to = filters.to ?? today()
    if (from > to || daysBetween(from, to) >= MAX_STATEMENT_DAYS) {
      toast.error(t('wallets.filters.periodTooLong'))
      return
    }
    setDownloading(true)
    try {
      const csv = await unwrap(api.GET('/api/v1/wallets/{walletId}/statement', {
        params: { path: { walletId }, query: { from, to } },
        parseAs: 'blob',
      }))
      saveFile(csv as Blob, t('wallets.filters.statementFile', { from, to }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const matches = useSuggestions(['movements', walletId], WHOLE_FOLIO.test(search.trim()) ? '' : search, async (q, signal) => {
    const page = await unwrap(api.GET('/api/v1/wallets/{walletId}/movements', {
      params: { path: { walletId }, query: { q, size: MAX_SUGGESTIONS } },
      signal,
    }))
    return (page.items ?? []).filter((m) => m.operationId).map((m) => ({
      value: m.operationId!,
      title: m.counterpartyName ?? m.operationId!,
      detail: [movementLabel(m.type, m.direction), m.description, formatDateTime(m.createdAt)].filter(Boolean).join(' · '),
      aside: `${m.direction === 'IN' ? '+' : '−'}${formatMoney(m.amount)}`,
    }))
  }, 2)

  const active = countActive(filters)
  return (
    <div className="grid gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          <SlidersHorizontal /> {active > 0 ? t('wallets.filters.filterCount', { count: active }) : t('common.filter')}
        </Button>
        {active > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); onChange({}) }}>
            <X /> {t('common.clear')}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={downloading || invalidPeriod}
            title={t('wallets.filters.csvHint')}>
            {downloading ? <Loader2 className="animate-spin" /> : <Download />} CSV
          </Button>
          <Link to={`/wallets/${walletId}/statement?${filters.from && filters.to && !invalidPeriod
            ? new URLSearchParams({ from: filters.from, to: filters.to }) : `month=${(filters.from ?? today()).slice(0, 7)}`}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <FileText /> {t('wallets.filters.statement')}
          </Link>
        </div>
      </div>
      {open && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <SegmentedControl label={t('wallets.filters.movementType')} size="sm" options={kinds} value={kindOf(filters)}
              onChange={(kind) => onChange({ ...filters, type: TYPES_OF_KIND[kind] })} />
            <SegmentedControl label={t('wallets.filters.direction')} size="sm" options={directions} value={filters.direction ?? ''}
              onChange={(direction) => onChange({ ...filters, direction: (direction || undefined) as MovementFilters['direction'] })} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t('common.from')}
              <Input type="date" value={filters.from ?? ''} min={firstDay} max={filters.to ?? today()}
                aria-invalid={invalidPeriod || undefined} onChange={(event) => changeDate('from', event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t('wallets.filters.to')}
              <Input type="date" value={filters.to ?? ''} min={filters.from ?? firstDay} max={today()}
                aria-invalid={invalidPeriod || undefined} onChange={(event) => changeDate('to', event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t('common.search')}
              <span className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <SuggestInput inputClassName="pl-8" placeholder={t('wallets.filters.searchPlaceholder')} value={search}
                  maxLength={MAX_SEARCH_LENGTH} onValueChange={setSearch}
                  suggestions={matches.suggestions} loading={matches.loading} noMatches={matches.settled} />
              </span>
            </label>
          </div>
          {invalidPeriod && <p className="text-xs text-destructive" role="alert">{t('wallets.filters.invalidPeriod')}</p>}
        </div>
      )}
    </div>
  )
}
