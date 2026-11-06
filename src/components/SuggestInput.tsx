import { Autocomplete } from '@base-ui/react/autocomplete'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** The most a preview shows, however many records match: the rest is a matter of typing more. */
export const MAX_SUGGESTIONS = 6

export interface Suggestion {
  /** What the field holds once this one is picked */
  value: string
  /** What else the screen needs to act on the pick, such as the id of the user whose email the field holds */
  meta?: string
  title: string
  /** A second line, such as an email under a name */
  detail?: string
  /** Shown at the end of the row: an amount, a status */
  aside?: ReactNode
}

/** The value after it stopped changing for a moment, so each keystroke doesn't fetch a page. */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

/**
 * What the API suggests for the text typed. Starts at `minLength` characters, waits for a pause in typing and caches
 * by text, so going back over the same letters doesn't ask again. A failure just shows nothing: the search itself
 * still works, and reports its own errors.
 */
export function useSuggestions(
  key: readonly unknown[],
  text: string,
  fetchSuggestions: (text: string, signal: AbortSignal) => Promise<Suggestion[]>,
  minLength = 2,
) {
  const typed = text.trim()
  const settled = useDebounced(typed)
  const enabled = settled.length >= minLength && settled === typed
  const query = useQuery({
    queryKey: ['suggestions', ...key, settled.toLowerCase()],
    queryFn: ({ signal }) => fetchSuggestions(settled, signal),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
  return {
    suggestions: enabled ? query.data ?? [] : [],
    // Also while the pause in typing lasts, so "no matches" never flashes for text not looked up yet
    loading: typed.length >= minLength && (!enabled || query.isPending),
    settled: enabled && query.isSuccess,
  }
}

/** The text with the part that was typed in bold, to show why a row matches. */
function Marked({ text, typed }: { text: string; typed: string }) {
  const start = typed ? text.toLowerCase().indexOf(typed.toLowerCase()) : -1
  if (start < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent font-semibold text-foreground">{text.slice(start, start + typed.length)}</mark>
      {text.slice(start + typed.length)}
    </>
  )
}

/**
 * A text field that previews what matches as it is typed. The field stays free text: Enter without a row highlighted
 * submits the surrounding form as usual, so whoever knows the exact value never has to pick a row. The arrows move
 * through the rows, Enter or a click picks one and Escape closes the list.
 */
export function SuggestInput({
  value, onValueChange, onPick, suggestions, loading, noMatches, inputClassName, ...input
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'defaultValue'> & {
  value: string
  onValueChange: (value: string) => void
  /** Runs when a row is picked, after the field takes its value */
  onPick?: (suggestion: Suggestion) => void
  suggestions: Suggestion[]
  loading?: boolean
  /** Said when the lookup found nothing; leave it out to show no list at all then */
  noMatches?: boolean
  inputClassName?: string
}) {
  const { t } = useTranslation()
  // Two movements of one operation share a folio
  const items = [...new Map(suggestions.map((item) => [item.value, item])).values()].slice(0, MAX_SUGGESTIONS)
  const typed = value.trim()
  const hasContent = items.length > 0 || !!loading || !!noMatches

  return (
    <Autocomplete.Root
      items={items}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      mode="none"
      itemToStringValue={(item: Suggestion) => item.value}
      openOnInputClick={false}
    >
      <Autocomplete.Input render={<Input {...input} className={inputClassName} />} />
      {hasContent && typed && (
        <Autocomplete.Portal>
          <Autocomplete.Positioner className="isolate z-50 outline-none" sideOffset={4} align="start">
            <Autocomplete.Popup
              data-slot="suggestions"
              className="max-h-[min(22rem,var(--available-height))] w-(--anchor-width) min-w-64 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0"
            >
              {items.length === 0 && (
                <p className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground" role="status">
                  {loading ? <><Loader2 className="size-4 animate-spin" /> {t('common.searching')}</> : t('common.noMatches')}
                </p>
              )}
              <Autocomplete.List>
                {(item: Suggestion) => (
                  <Autocomplete.Item
                    key={item.value}
                    value={item}
                    onClick={() => onPick?.(item)}
                    className={cn(
                      'flex cursor-default items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm outline-none select-none',
                      'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate"><Marked text={item.title} typed={typed} /></span>
                      {item.detail && (
                        <span className="block truncate text-xs text-muted-foreground"><Marked text={item.detail} typed={typed} /></span>
                      )}
                    </span>
                    {item.aside && <span className="shrink-0 text-xs text-muted-foreground">{item.aside}</span>}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      )}
    </Autocomplete.Root>
  )
}
