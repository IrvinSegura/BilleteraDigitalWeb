import { cn } from '@/lib/utils'

/** A row of mutually exclusive buttons for a filter or a period; the pressed one is the current value. */
export function SegmentedControl<T extends string | number | boolean>({ options, value, onChange, label, size = 'md' }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn('rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
