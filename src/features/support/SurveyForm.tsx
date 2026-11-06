import { useMutation } from '@tanstack/react-query'
import { Loader2, Star } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SCORES = [1, 2, 3, 4, 5]

/** How it went, asked once an agent attended the conversation. Writing again skips it. */
export function SurveyForm({ onAnswered }: { onAnswered: () => void }) {
  const { t } = useTranslation()
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const answer = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/conversation/survey', {
      body: { score, comment: comment.trim() || undefined },
    })),
    onSuccess: onAnswered,
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    answer.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div>
        <p className="font-medium">{t('support.surveyTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('support.surveyHint')}</p>
      </div>
      <div role="group" aria-label={t('support.surveyScore')} className="flex gap-1">
        {SCORES.map((value) => (
          <button key={value} type="button" aria-pressed={score === value} aria-label={t('support.surveyStars', { score: value })}
            onClick={() => setScore(value)} className="rounded-md p-1.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            <Star className={cn('size-6', value <= score ? 'fill-warning text-warning' : 'text-muted-foreground')} />
          </button>
        ))}
      </div>
      <FormField label={t('support.surveyComment')}>
        {(field) => (
          <textarea {...field} rows={2} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
        )}
      </FormField>
      <FormError message={answer.isError ? errorMessage(answer.error) : null} />
      <Button type="submit" disabled={score === 0 || answer.isPending}>
        {answer.isPending && <Loader2 className="animate-spin" />} {t('support.surveySend')}
      </Button>
    </form>
  )
}
