import { KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage, hasCode } from '@/api/errors'
import { useUser } from '@/auth/auth-context'
import { CodeInput } from '@/components/CodeInput'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'

/** How the API wants the owner to prove they're there before money leaves: the 2FA code, or the password. */
export type StepUpMethod = 'code' | 'password'

/** The step-up method an API error asks for, if it is one of those requests. */
export function stepUpRequested(error: unknown): StepUpMethod | null {
  if (hasCode(error, 'TWO_FACTOR_REQUIRED')) return 'code'
  if (hasCode(error, 'PASSWORD_CONFIRMATION_REQUIRED')) return 'password'
  return null
}

/**
 * The step-up proof for a money movement. Transfers start without it and ask only when the API requests it
 * (small amounts to someone paid before are exempt); withdrawals always need it, so they ask from the start.
 */
export function useStepUp(askUpFront: boolean) {
  const user = useUser()
  const [method, setMethod] = useState<StepUpMethod | null>(
    askUpFront ? (user.twoFactorEnabled ? 'code' : 'password') : null,
  )
  const [value, setValue] = useState('')

  return {
    method,
    value,
    setValue,
    /** Request body fields with the proof, when there is one. */
    fields: method === 'code' && value ? { twoFactorCode: value }
      : method === 'password' && value ? { currentPassword: value } : {},
    ready: method === null || (method === 'code' ? value.length >= 6 : value.length > 0),
    /** Reacts to a failed attempt: shows the field it asks for, or clears a wrong proof. True if handled. */
    handle(error: unknown): boolean {
      const requested = stepUpRequested(error)
      if (requested) {
        setMethod(requested)
        setValue('')
        return true
      }
      if (hasCode(error, 'INVALID_TWO_FACTOR_CODE') || hasCode(error, 'INCORRECT_PASSWORD')) {
        setValue('')
      }
      return false
    },
  }
}

export function StepUpField({ stepUp, error }: { stepUp: ReturnType<typeof useStepUp>; error: unknown }) {
  const { t } = useTranslation()
  if (!stepUp.method) {
    return null
  }
  const wrong = hasCode(error, 'INVALID_TWO_FACTOR_CODE') || hasCode(error, 'INCORRECT_PASSWORD')
  const Icon = stepUp.method === 'code' ? ShieldCheck : KeyRound
  return (
    <div className="grid gap-3 rounded-xl border border-primary/25 bg-accent/40 p-4 animate-in fade-in-0 slide-in-from-top-1">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="text-sm">
          <p className="font-medium">{t('money.stepUp.title')}</p>
          <p className="text-muted-foreground">
            {t(stepUp.method === 'code' ? 'money.stepUp.codeHint' : 'money.stepUp.passwordHint')}
          </p>
        </div>
      </div>
      <FormField label={t(stepUp.method === 'code' ? 'common.verificationCode' : 'common.password')}
        error={wrong ? errorMessage(error) : undefined}>
        {(field) => stepUp.method === 'code'
          ? <CodeInput {...field} autoFocus value={stepUp.value} onValueChange={stepUp.setValue} />
          : <PasswordInput {...field} autoFocus autoComplete="current-password" value={stepUp.value}
              onChange={(e) => stepUp.setValue(e.target.value)} />}
      </FormField>
    </div>
  )
}
