import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A big amount field with the currency beside it. Keeps only digits and one decimal point with up to two
 * decimals, so what the user types is what the API receives.
 */
export function AmountInput({ currency, value, onValueChange, className, ...props }: {
  currency: string
  value: string
  onValueChange: (value: string) => void
} & Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'>) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border border-input bg-background px-4 transition-colors',
      'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40',
      'has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:bg-input/30',
      className,
    )}>
      <span className="text-2xl font-medium text-muted-foreground">$</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(event) => {
          const cleaned = event.target.value.replace(/[^\d.]/g, '')
          if (/^\d{0,12}(\.\d{0,2})?$/.test(cleaned)) {
            onValueChange(cleaned)
          }
        }}
        className="h-16 w-0 min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight tabular outline-none placeholder:text-muted-foreground/50"
        {...props}
      />
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{currency}</span>
    </div>
  )
}
