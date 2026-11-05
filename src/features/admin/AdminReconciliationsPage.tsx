import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, Play, Scale } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { ListSkeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCount, formatDateTime, formatMinor, formatRelative } from '@/lib/format'
import { labelOf, operationStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError, IdCell } from './shared'

const queryKey = ['admin', 'reconciliations']

function Run({ run }: { run: Schemas['ReconciliationResponse'] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const discrepancies = run.discrepancies ?? []
  const seconds = run.startedAt && run.finishedAt ? (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000 : null
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={discrepancies.length === 0} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors enabled:hover:bg-muted/40">
        <StatusBadge value={run.status} map={operationStatus} />
        <span className="flex-1 text-sm">
          <span className="font-medium">{t(run.trigger === 'MANUAL' ? 'admin.reconciliations.manual' : 'admin.reconciliations.scheduled')}</span>
          <span className="text-muted-foreground"> · {formatRelative(run.startedAt)}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular">
          {t('admin.reconciliations.checked', { accounts: formatCount(run.accountsChecked), entries: formatCount(run.entriesChecked) })}
          {seconds !== null && ` · ${t('admin.reconciliations.seconds', { seconds: seconds.toFixed(1) })}`}
        </span>
        {discrepancies.length > 0 && <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />}
      </button>
      {open && (
        <div className="border-t bg-muted/30 px-5 py-4">
          <p className="mb-3 text-xs text-muted-foreground">{t('admin.reconciliations.startedAt', { date: formatDateTime(run.startedAt) })}</p>
          <ul className="grid gap-2">
            {discrepancies.map((d, i) => (
              <li key={i} className="grid gap-1 rounded-lg border bg-card px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                <span>
                  <span className="font-medium">{labelOf('labels.discrepancies', d.kind ?? '')}</span>
                  {d.subjectId && <span className="ml-2"><IdCell id={d.subjectId} /></span>}
                </span>
                <span className="text-muted-foreground tabular">{t('admin.reconciliations.expected', { amount: formatMinor(d.expectedMinor, d.currency) })}</span>
                <span className="font-medium text-destructive tabular">{t('admin.reconciliations.actual', { amount: formatMinor(d.actualMinor, d.currency) })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

export function AdminReconciliationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const runs = useQuery({
    queryKey,
    queryFn: () => unwrap(api.GET('/api/v1/admin/reconciliations', { params: { query: { limit: 30 } } })),
  })
  const reconcile = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/reconciliations')),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey })
      if (run.status === 'CONSISTENT') toast.success(t('admin.reconciliations.consistentToast'))
      else toast.error(t('admin.reconciliations.differencesToast', { count: run.discrepancies?.length ?? 0 }))
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const latest = runs.data?.[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.reconciliations.title')}
        description={t('admin.reconciliations.description')}
        actions={<Button onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>
          {reconcile.isPending ? <Loader2 className="animate-spin" /> : <Play />} {t('admin.reconciliations.run')}
        </Button>}
      />
      {latest && (
        <div className={cn('flex items-center gap-4 rounded-2xl border p-5',
          latest.status === 'CONSISTENT' ? 'border-success/30 bg-success/6' : 'border-destructive/30 bg-destructive/6')}>
          <span className={cn('flex size-11 items-center justify-center rounded-xl',
            latest.status === 'CONSISTENT' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
            <Scale className="size-5" />
          </span>
          <div>
            <p className="font-medium">{latest.status === 'CONSISTENT' ? t('admin.reconciliations.allGood') : t('admin.reconciliations.differences', { count: latest.discrepancies?.length ?? 0 })}</p>
            <p className="text-sm text-muted-foreground">{t('admin.reconciliations.lastCheck', { when: formatRelative(latest.finishedAt) })}</p>
          </div>
        </div>
      )}
      <Card className="gap-0 py-0">
        {runs.isPending ? <ListSkeleton rows={4} /> : runs.isError ? <AdminError error={runs.error} onRetry={() => runs.refetch()} /> : runs.data.length === 0 ? (
          <EmptyState icon={Scale} title={t('admin.reconciliations.emptyTitle')} description={t('admin.reconciliations.emptyHint')} />
        ) : (
          <ul className="divide-y">{runs.data.map((run) => <Run key={run.id} run={run} />)}</ul>
        )}
      </Card>
    </div>
  )
}
