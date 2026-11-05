import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Filter, ScrollText, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SuggestInput } from '@/components/SuggestInput'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { currentLanguage } from '@/i18n'
import { formatDateTime } from '@/lib/format'
import { labelOf } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { auditActions, auditDetails, endOfDay, startOfDay } from './audit-labels'
import { AdminError, IdCell, useUserSuggestions } from './shared'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const day = /^\d{4}-\d{2}-\d{2}$/

const ALL_ACTIONS = 'ALL'

// Provider movements have no page of their own, and a ledger entry's id means nothing to the operations search
function targetLink(type: string | undefined, id: string | undefined) {
  if (!id) return undefined
  if (type === 'USER') return `/admin/users/${id}`
  if (type === 'WALLET') return `/admin/operations?type=wallet&id=${id}`
  return undefined
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

export function AdminAuditPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const actorId = params.get('actor') ?? ''
  const targetId = params.get('target') ?? ''
  const action = auditActions.find((a) => a === params.get('action')) ?? ''
  const from = day.test(params.get('from') ?? '') ? params.get('from')! : ''
  const to = day.test(params.get('to') ?? '') ? params.get('to')! : ''

  const [page, setPage] = useState(0)
  const [actorDraft, setActorDraft] = useState(actorId)
  const [targetDraft, setTargetDraft] = useState(targetId)
  const [actionDraft, setActionDraft] = useState<string>(action || ALL_ACTIONS)
  const [fromDraft, setFromDraft] = useState(from)
  const [toDraft, setToDraft] = useState(to)
  const invalidId = [actorDraft, targetDraft].some((v) => v.trim() && !uuid.test(v.trim()))
  const invalidRange = !!fromDraft && !!toDraft && fromDraft > toDraft
  // Text that isn't an id yet is a search in progress, so it only counts as a mistake on trying to filter by it
  const [attempted, setAttempted] = useState(false)
  // Picking a row fills in the user's id, which is what the filter takes
  const actorPreview = useUserSuggestions('audit-actor', uuid.test(actorDraft.trim()) ? '' : actorDraft, (user) => user.id!)
  const targetPreview = useUserSuggestions('audit-target', uuid.test(targetDraft.trim()) ? '' : targetDraft, (user) => user.id!)

  const events = useQuery({
    queryKey: ['admin', 'audit', actorId, targetId, action, from, to, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/audit-events', {
      params: {
        query: {
          actorId: actorId || undefined,
          targetId: targetId || undefined,
          action: action || undefined,
          from: from ? startOfDay(from) : undefined,
          to: to ? endOfDay(to) : undefined,
          page,
          size: 25,
        },
      },
    })),
    placeholderData: keepPreviousData,
  })
  const items = events.data?.items ?? []
  const filtered = !!(actorId || targetId || action || from || to)
  const actionOptions = [
    { value: ALL_ACTIONS, label: t('admin.audit.allActions') },
    ...auditActions
      .map((value) => ({ value, label: labelOf('admin.audit.actions', value) }))
      .sort((a, b) => a.label.localeCompare(b.label, currentLanguage())),
  ]

  function clear() {
    setActorDraft('')
    setTargetDraft('')
    setActionDraft(ALL_ACTIONS)
    setFromDraft('')
    setToDraft('')
    setPage(0)
    setParams({})
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.audit.title')} description={t('admin.audit.description')} />
      <Card className="p-4">
        <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            setAttempted(true)
            if (invalidId || invalidRange) return
            const next: Record<string, string> = {}
            if (actorDraft.trim()) next.actor = actorDraft.trim()
            if (targetDraft.trim()) next.target = targetDraft.trim()
            if (actionDraft !== ALL_ACTIONS) next.action = actionDraft
            if (fromDraft) next.from = fromDraft
            if (toDraft) next.to = toDraft
            setPage(0)
            setParams(next)
          }}>
          <FilterField label={t('admin.action')}>
            <Select value={actionDraft} onValueChange={setActionDraft} options={actionOptions} aria-label={t('admin.action')} />
          </FilterField>
          <FilterField label={t('common.from')}>
            <Input type="date" value={fromDraft} max={toDraft || undefined} onChange={(e) => setFromDraft(e.target.value)} />
          </FilterField>
          <FilterField label={t('admin.audit.until')}>
            <Input type="date" value={toDraft} min={fromDraft || undefined} onChange={(e) => setToDraft(e.target.value)} />
          </FilterField>
          <FilterField label={t('admin.audit.actorField')}>
            <SuggestInput value={actorDraft} onValueChange={(next) => { setActorDraft(next); setAttempted(false) }} inputClassName="font-mono text-sm"
              placeholder={t('admin.audit.userPlaceholder')}
              suggestions={actorPreview.suggestions} loading={actorPreview.loading} noMatches={actorPreview.settled} />
          </FilterField>
          <FilterField label={t('admin.audit.targetField')}>
            <SuggestInput value={targetDraft} onValueChange={(next) => { setTargetDraft(next); setAttempted(false) }} inputClassName="font-mono text-sm"
              placeholder={t('admin.audit.userPlaceholder')}
              suggestions={targetPreview.suggestions} loading={targetPreview.loading} noMatches={targetPreview.settled} />
          </FilterField>
          <div className="flex gap-2">
            <Button type="submit" disabled={(attempted && invalidId) || invalidRange}><Filter /> {t('common.filter')}</Button>
            {filtered && <Button type="button" variant="ghost" onClick={clear}><X /> {t('common.clear')}</Button>}
          </div>
        </form>
        {attempted && invalidId && <p className="mt-2 text-xs text-destructive">{t('admin.audit.invalidFilter')}</p>}
        {invalidRange && <p className="mt-2 text-xs text-destructive">{t('admin.audit.invalidRange')}</p>}
      </Card>
      <Card className="gap-0 py-0">
        {events.isPending ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div> : events.isError ? (
          <AdminError error={events.error} onRetry={() => events.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={ScrollText} title={t('admin.audit.emptyTitle')} description={t(filtered ? 'admin.audit.emptyFiltered' : 'admin.audit.empty')} />
        ) : (
          <Table className={cn(events.isPlaceholderData && 'opacity-60')}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{t('common.date')}</TableHead>
                <TableHead>{t('admin.action')}</TableHead>
                <TableHead>{t('admin.audit.actor')}</TableHead>
                <TableHead>{t('admin.audit.target')}</TableHead>
                <TableHead className="hidden pr-5 xl:table-cell">{t('admin.audit.details')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => {
                const details = auditDetails(e.action, e.details)
                return (
                  <TableRow key={e.id}>
                    <TableCell className="pl-5 align-top whitespace-nowrap text-muted-foreground">{formatDateTime(e.occurredAt)}</TableCell>
                    <TableCell className="align-top font-medium">
                      <span className="block max-w-72 whitespace-normal" title={e.action}>{e.action ? labelOf('admin.audit.actions', e.action) : '—'}</span>
                      {/* Beside the table's own column on wide screens; here it would be out of reach otherwise */}
                      {e.details && <span className="mt-0.5 block max-w-72 text-xs font-normal wrap-break-word whitespace-normal text-muted-foreground xl:hidden" title={e.details}>{details}</span>}
                    </TableCell>
                    <TableCell className="align-top">
                      {e.actorId ? <IdCell id={e.actorId} to={`/admin/users/${e.actorId}`} /> : <span className="text-xs text-muted-foreground">{t('admin.audit.system')}</span>}
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="mr-1 text-xs text-muted-foreground">{labelOf('admin.audit.targets', e.targetType ?? '')}</span>
                      <IdCell id={e.targetId} to={targetLink(e.targetType, e.targetId)} />
                    </TableCell>
                    <TableCell className="hidden max-w-96 pr-5 align-top text-xs wrap-break-word whitespace-normal text-muted-foreground xl:table-cell" title={e.details}>{details}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <Pager page={page} hasNext={!!events.data?.hasNext} onPageChange={setPage} disabled={events.isFetching} />
      </Card>
    </div>
  )
}
