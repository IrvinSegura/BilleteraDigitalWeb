import { cn } from '@/lib/utils'

/** An on/off toggle; screen readers announce it as a switch with its state. */
export function Switch({ checked, onCheckedChange, disabled, className, ...props }: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span className={cn('size-5 rounded-full bg-background shadow-sm transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  )
}
