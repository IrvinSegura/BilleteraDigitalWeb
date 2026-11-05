import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * The authenticator app's 6 digits or a recovery code; letters and dashes are kept so recovery codes fit too.
 */
export function CodeInput({ value, onValueChange, className, ...props }: {
  value: string
  onValueChange: (value: string) => void
} & Omit<ComponentProps<'input'>, 'value' | 'onChange'>) {
  return (
    <Input
      autoComplete="one-time-code"
      inputMode="text"
      maxLength={20}
      placeholder="123 456"
      value={value}
      onChange={(event) => onValueChange(event.target.value.replace(/[^A-Za-z0-9-]/g, ''))}
      className={cn('h-11 text-center font-mono text-lg tracking-[0.3em]', className)}
      {...props}
    />
  )
}
