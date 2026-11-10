import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellRing, Clock, Flame, Users } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCount, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

import { type AlertPrefs, desktopPermission } from './inbox-alerts'

export type AgentSummary = Schemas['AgentSummary']

// Past this a wait is shown as too long, so whoever can take cases does
export const LONG_WAIT_SECONDS = 10 * 60
const METRICS_DAYS = 30

export const SUMMARY_KEY = ['support', 'inbox', 'summary'] as const

/** Whether new cases come to the agent. Pausing keeps the case they are attending. */
export function AvailabilityToggle({ summary }: { summary: AgentSummary | undefined }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const labelId = useId()
  const available = summary?.available ?? true
  const change = useMutation({
    mutationFn: (next: boolean) => unwrap(api.PUT('/api/v1/support/agent/availability', { body: { available: next } })),
    onSuccess: (next) => {
      queryClient.setQueryData(SUMMARY_KEY, next)
      toast.success(t(next.available ? 'support.inbox.availability.on' : 'support.inbox.availability.off'))
      // Coming back may bring a case at once
      void queryClient.invalidateQueries({ queryKey: ['support', 'inbox', 'list'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-2',
      available ? 'border-success/30 bg-success/10' : 'border-border bg-muted/50')}>
      <span className={cn('size-2.5 rounded-full', available ? 'bg-success' : 'bg-muted-foreground')} aria-hidden="true" />
      <span className="grid text-sm leading-tight">
        <span id={labelId} className="font-medium">{t(available ? 'support.inbox.availability.available' : 'support.inbox.availability.paused')}</span>
        <span className="text-xs text-muted-foreground">{t('support.inbox.availability.label')}</span>
      </span>
      <Switch checked={available} disabled={!summary || change.isPending} aria-labelledby={labelId}
        onCheckedChange={(next) => change.mutate(next)} className="ml-1" />
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'warning' | 'danger' }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5',
      tone === 'warning' && 'border-warning/40 bg-warning/10', tone === 'danger' && 'border-destructive/30 bg-destructive/10')}>
      {/* On a phone three tiles share the width: the label needs the icon's room */}
      <span className={cn('hidden size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex',
        tone === 'warning' && 'bg-warning/20 text-warning-foreground dark:text-warning', tone === 'danger' && 'bg-destructive/15 text-destructive')}>
        {icon}
      </span>
      <span className="grid min-w-0">
        <span className="text-xs leading-tight text-muted-foreground sm:truncate">{label}</span>
        <span className="truncate text-base font-semibold tabular">{value}</span>
      </span>
    </div>
  )
}

/** How the queue is: how many wait, how many are about money, and how long the oldest has waited. */
export function QueueStatus({ summary, now }: { summary: AgentSummary | undefined; now: number }) {
  const { t } = useTranslation()
  const waitedSeconds = summary?.oldestQueuedAt ? (now - Date.parse(summary.oldestQueuedAt)) / 1000 : undefined
  const longWait = waitedSeconds != null && waitedSeconds >= LONG_WAIT_SECONDS
  return (
    <section aria-label={t('support.inbox.queue.label')} className="grid grid-cols-3 gap-2 sm:gap-3">
      <Stat icon={<Users className="size-4" />} label={t('support.inbox.queue.waiting')} value={formatCount(summary?.queued)} />
      <Stat icon={<Flame className="size-4" />} label={t('support.inbox.queue.urgent')} value={formatCount(summary?.queuedHighPriority)}
        tone={(summary?.queuedHighPriority ?? 0) > 0 ? 'danger' : undefined} />
      <Stat icon={<Clock className="size-4" />} label={t('support.inbox.queue.longest')}
        value={<span title={longWait ? t('support.inbox.queue.longWait') : undefined}>{formatDuration(waitedSeconds)}</span>}
        tone={longWait ? 'warning' : undefined} />
    </section>
  )
}

/** The agent's own numbers for the last month. */
export function AgentMetrics() {
  const { t } = useTranslation()
  const metrics = useQuery({
    queryKey: ['support', 'inbox', 'metrics', METRICS_DAYS],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/metrics', { params: { query: { days: METRICS_DAYS } } })),
    staleTime: 60_000,
  })
  const data = metrics.data
  const score = data?.averageScore
  const items = [
    { label: t('support.inbox.metrics.attended'), value: data ? formatCount(data.attended) : '—' },
    { label: t('support.inbox.metrics.resolved'), value: data ? formatCount(data.resolved) : '—' },
    { label: t('support.inbox.metrics.firstResponse'), value: formatDuration(data?.firstResponseSeconds) },
    { label: t('support.inbox.metrics.rating'), value: score == null ? '—' : `${Math.round(score * 10) / 10} / 5` },
  ]
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {/* The gaps show the border behind: even lines between cells in two columns or four */}
      <dl aria-label={t('support.inbox.metrics.label')} className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="grid gap-0.5 bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-lg font-semibold tabular">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function PrefRow({ label, hint, checked, disabled, onChange }: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="grid gap-0.5">
        <span id={id} className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-labelledby={id} />
    </div>
  )
}

/** Where the agent chooses how they are told of a new case or message. */
export function AlertsButton({ prefs, onChange, unseen }: { prefs: AlertPrefs; onChange: (next: Partial<AlertPrefs>) => void; unseen: number }) {
  const { t } = useTranslation()
  const [permission, setPermission] = useState(desktopPermission)
  const toggleDesktop = async (next: boolean) => {
    if (next && permission === 'default') {
      const answer = await Notification.requestPermission()
      setPermission(answer)
      onChange({ desktop: answer === 'granted' })
      return
    }
    onChange({ desktop: next })
  }
  const on = prefs.sound || prefs.desktop
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="relative" />}>
        {on ? <BellRing /> : <Bell />} {t('support.inbox.alerts.open')}
        {unseen > 0 && <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[0.65rem] font-semibold text-white">{unseen}</span>}
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('support.inbox.alerts.title')}</DialogTitle>
            <DialogDescription>{t('support.inbox.alerts.hint')}</DialogDescription>
          </DialogHeader>
          <PrefRow label={t('support.inbox.alerts.sound')} hint={t('support.inbox.alerts.soundHint')} checked={prefs.sound}
            onChange={(next) => onChange({ sound: next })} />
          <PrefRow label={t('support.inbox.alerts.desktop')}
            hint={permission === 'unsupported' ? t('support.inbox.alerts.unsupported')
              : permission === 'denied' ? t('support.inbox.alerts.blocked') : t('support.inbox.alerts.desktopHint')}
            checked={prefs.desktop && permission === 'granted'} disabled={permission === 'unsupported' || permission === 'denied'}
            onChange={(next) => void toggleDesktop(next)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
