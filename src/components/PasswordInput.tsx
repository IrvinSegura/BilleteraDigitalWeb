import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { passwordStrength } from '@/lib/password-strength'
import { cn } from '@/lib/utils'

export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={t(visible ? 'common.hidePassword' : 'common.showPassword')}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

/**
 * Five bars that fill as the password gets longer and more varied, and stay at one for a password that is easy to
 * guess. Only a guide: the API has the last word, with a longer list of common passwords and known breaches.
 *
 * @param personal the user's email and name, which the password must not be built from
 */
export function PasswordStrength({ password, personal }: { password: string; personal?: readonly (string | undefined)[] }) {
  if (!password) {
    return null
  }
  const { score, label } = passwordStrength(password, personal)
  const color = score <= 1 ? 'bg-destructive' : score === 2 ? 'bg-warning' : 'bg-success'
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < score ? color : 'bg-muted')} />
        ))}
      </div>
      <span className="min-w-20 whitespace-nowrap text-right text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
