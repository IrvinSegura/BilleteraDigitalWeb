import { labelOf } from '@/lib/labels'
import { cn } from '@/lib/utils'

// Flag emojis render as letters on Windows, so each currency gets its own symbol and color instead
const styles: Record<string, { symbol: string; classes: string }> = {
  MXN: { symbol: '$', classes: 'from-emerald-500 to-teal-600' },
  USD: { symbol: 'US$', classes: 'from-sky-500 to-indigo-600' },
}

export function currencyName(currency: string): string {
  return labelOf('labels.currencies', currency)
}

export function CurrencyIcon({ currency, className }: { currency: string | undefined; className?: string }) {
  const style = styles[currency ?? ''] ?? { symbol: currency?.slice(0, 1) ?? '?', classes: 'from-slate-500 to-slate-700' }
  return (
    <span aria-hidden className={cn(
      'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold tracking-tight text-white shadow-sm',
      style.classes, className,
    )}>
      {style.symbol}
    </span>
  )
}
