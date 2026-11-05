import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { Switch } from '@/components/Switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MessageKey } from '@/i18n'

type Preferences = Required<Schemas['PreferencesResponse']>

const preferencesKey = ['notifications', 'preferences'] as const

const OPTIONS: { key: keyof Preferences; title: MessageKey; description: MessageKey }[] = [
  { key: 'emailMoneyIn', title: 'settings.emailPreferences.moneyInTitle', description: 'settings.emailPreferences.moneyInHint' },
  { key: 'emailMoneyOut', title: 'settings.emailPreferences.moneyOutTitle', description: 'settings.emailPreferences.moneyOutHint' },
  { key: 'emailSignIns', title: 'settings.emailPreferences.signInsTitle', description: 'settings.emailPreferences.signInsHint' },
]

/** Which notifications also arrive by email; they all stay in the app's inbox either way. */
export function EmailPreferencesCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const preferences = useQuery({
    queryKey: preferencesKey,
    queryFn: async () => {
      const p = await unwrap(api.GET('/api/v1/notifications/preferences'))
      return { emailMoneyIn: p.emailMoneyIn ?? true, emailMoneyOut: p.emailMoneyOut ?? true, emailSignIns: p.emailSignIns ?? true }
    },
  })
  const update = useMutation({
    mutationFn: (next: Preferences) => unwrap(api.PUT('/api/v1/notifications/preferences', { body: next })),
    // The switch moves at once; a refused change moves it back
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: preferencesKey })
      const previous = queryClient.getQueryData<Preferences>(preferencesKey)
      queryClient.setQueryData(preferencesKey, next)
      return { previous }
    },
    onError: (error, _next, context) => {
      queryClient.setQueryData(preferencesKey, context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: preferencesKey }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.emailPreferences.title')}</CardTitle>
        <CardDescription>
          {t('settings.emailPreferences.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {preferences.error ? <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />
          : !preferences.data ? <Skeleton className="h-28" /> : (
            <ul className="divide-y rounded-xl border">
              {OPTIONS.map((option) => (
                <li key={option.key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="text-sm">
                    <p id={`pref-${option.key}`} className="font-medium">{t(option.title)}</p>
                    <p id={`pref-${option.key}-hint`} className="text-xs text-muted-foreground">{t(option.description)}</p>
                  </div>
                  <Switch checked={preferences.data[option.key]} aria-labelledby={`pref-${option.key}`}
                    aria-describedby={`pref-${option.key}-hint`}
                    onCheckedChange={(checked) => update.mutate({ ...preferences.data, [option.key]: checked })} />
                </li>
              ))}
            </ul>
          )}
      </CardContent>
    </Card>
  )
}
