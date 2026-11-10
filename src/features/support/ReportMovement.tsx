import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMovement } from '@/features/wallets/operation'
import { formatDateTime, formatMoney } from '@/lib/format'
import { movementLabel } from '@/lib/labels'

import type { Conversation } from './support-api'

// Leaves room in the chat's 2000 characters for the line that says which movement it is
const MAX_REPORT = 1500
// The API refuses these in a message
const MARKUP = /[<>]/

/**
 * What the "report a problem" of a movement opens: the customer says what happened, and it reaches a person with the
 * movement named, instead of the bot and instead of explaining it all over in the chat. Shows nothing unless the
 * address names a movement this customer can read.
 */
export function ReportMovement({ status, onSent }: { status: string | undefined; onSent: (conversation: Conversation) => void }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const walletId = params.get('wallet') ?? ''
  const transactionId = params.get('movement') ?? ''
  const movement = useMovement(walletId, transactionId, !!walletId && !!transactionId)
  const [what, setWhat] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const dismiss = () => setParams({}, { replace: true })

  const label = movementLabel(movement.data?.type, movement.data?.direction)
  const amount = formatMoney(movement.data?.amount)
  const date = formatDateTime(movement.data?.createdAt)

  const report = useMutation({
    mutationFn: async () => {
      const text = t('support.report.message', {
        kind: label, amount, date, folio: movement.data?.operationId ?? transactionId, what: what.trim(),
        interpolation: { escapeValue: false },
      })
      // On the way to a person first, so the bot does not answer a report it can't solve
      if (status !== 'QUEUED' && status !== 'ASSIGNED') {
        onSent(await unwrap(api.POST('/api/v1/support/conversation/escalate')))
      }
      return unwrap(api.POST('/api/v1/support/conversation/messages', { body: { text } }))
    },
    onSuccess: (conversation) => {
      onSent(conversation)
      dismiss()
    },
  })

  if (!movement.data) return null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (MARKUP.test(what)) {
      setProblem(t('support.noMarkup'))
      return
    }
    setProblem(null)
    report.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('support.report.title')}</CardTitle>
        <CardDescription>{t('support.report.hint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <p className="rounded-lg border px-3 py-2 text-sm">
            <span className="font-medium">{label}</span> · <span className="tabular">{amount}</span>
            <span className="block text-xs text-muted-foreground">{date}</span>
          </p>
          <FormField label={t('support.report.field')} hint={t('support.report.fieldHint')}>
            {(field) => (
              <textarea {...field} required autoFocus maxLength={MAX_REPORT} rows={3} value={what}
                onChange={(event) => { setWhat(event.target.value); setProblem(null) }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
            )}
          </FormField>
          <FormError message={problem ?? (report.isError ? errorMessage(report.error) : null)} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={dismiss}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!what.trim() || report.isPending}>
              {report.isPending && <Loader2 className="animate-spin" />} {t('support.report.send')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
