import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SuggestInput, useSuggestions } from '@/components/SuggestInput'
import { Select } from '@/components/ui/select'
import i18n from '@/i18n'
import { formatDateTime, formatMoney } from '@/lib/format'
import { operationStatus, walletStatus } from '@/lib/labels'

import { AdminError, DetailGrid, IdCell } from './shared'

const operationKinds = ['transfer', 'deposit', 'withdrawal', 'wallet'] as const

type OperationKind = (typeof operationKinds)[number]
type Kind = 'all' | OperationKind

const kinds: readonly Kind[] = ['all', ...operationKinds]

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function userLink(id: string | undefined) {
  return id ? <IdCell id={id} to={`/admin/users/${id}`} /> : '—'
}

async function fetchOperation(kind: OperationKind, id: string) {
  switch (kind) {
    case 'transfer':
      return { kind: 'transfer' as const, data: await unwrap(api.GET('/api/v1/admin/transfers/{transferId}', { params: { path: { transferId: id } } })) }
    case 'deposit':
      return { kind: 'deposit' as const, data: await unwrap(api.GET('/api/v1/admin/deposits/{depositId}', { params: { path: { depositId: id } } })) }
    case 'withdrawal':
      return { kind: 'withdrawal' as const, data: await unwrap(api.GET('/api/v1/admin/withdrawals/{withdrawalId}', { params: { path: { withdrawalId: id } } })) }
    case 'wallet':
      return { kind: 'wallet' as const, data: await unwrap(api.GET('/api/v1/admin/wallets/{walletId}', { params: { path: { walletId: id } } })) }
  }
}

/** What a lookup found, in the active language. It runs on every render so a language change reaches it. */
function describeOperation(operation: Awaited<ReturnType<typeof fetchOperation>>) {
  switch (operation.kind) {
    case 'transfer': {
      const t = operation.data
      return {
        title: i18n.t('admin.operations.transfer'), amount: t.amount, status: undefined as string | undefined, rows: [
          { label: i18n.t('admin.operations.sender'), value: userLink(t.senderId) },
          { label: i18n.t('admin.operations.sourceWallet'), value: <IdCell id={t.sourceWalletId} /> },
          { label: i18n.t('admin.operations.recipient'), value: <span className="flex items-center gap-1">{t.recipientEmail}</span> },
          { label: i18n.t('admin.operations.destinationWallet'), value: <IdCell id={t.destinationWalletId} /> },
          { label: i18n.t('common.concept'), value: t.description || '—' },
          { label: i18n.t('admin.operations.journalEntry'), value: <IdCell id={t.journalEntryId} /> },
          { label: i18n.t('common.date'), value: formatDateTime(t.createdAt) },
        ],
      }
    }
    case 'deposit': {
      const d = operation.data
      return {
        title: i18n.t('admin.operations.deposit'), amount: d.amount, status: d.status, rows: [
          { label: i18n.t('admin.operations.user'), value: userLink(d.userId) },
          { label: i18n.t('common.wallet'), value: <IdCell id={d.walletId} /> },
          { label: i18n.t('common.balanceAfter'), value: formatMoney(d.balanceAfter) },
          { label: i18n.t('admin.operations.journalEntry'), value: <IdCell id={d.journalEntryId} /> },
          { label: i18n.t('admin.operations.rejectionReason'), value: d.rejectionReason || '—' },
          { label: i18n.t('admin.operations.created'), value: formatDateTime(d.createdAt) },
          { label: i18n.t('admin.operations.closed'), value: formatDateTime(d.closedAt) },
        ],
      }
    }
    case 'withdrawal': {
      const w = operation.data
      return {
        title: i18n.t('admin.operations.withdrawal'), amount: w.amount, status: w.status, rows: [
          { label: i18n.t('admin.operations.user'), value: userLink(w.userId) },
          { label: i18n.t('common.wallet'), value: <IdCell id={w.walletId} /> },
          { label: i18n.t('common.bankAccount'), value: <IdCell id={w.bankAccountId} /> },
          { label: i18n.t('admin.operations.providerReference'), value: w.providerReference || '—' },
          { label: i18n.t('common.balanceAfter'), value: formatMoney(w.balanceAfter) },
          { label: i18n.t('admin.operations.withdrawalEntry'), value: <IdCell id={w.journalEntryId} /> },
          { label: i18n.t('admin.operations.settlementEntry'), value: <IdCell id={w.settlementEntryId} /> },
          { label: i18n.t('admin.operations.failureReason'), value: w.failureReason || '—' },
          { label: i18n.t('admin.operations.created'), value: formatDateTime(w.createdAt) },
          { label: i18n.t('admin.operations.closed'), value: formatDateTime(w.closedAt) },
        ],
      }
    }
    case 'wallet': {
      const w = operation.data
      return {
        title: i18n.t('common.walletOf', { currency: w.balance?.currency ?? '' }), amount: w.balance, status: undefined, rows: [
          { label: i18n.t('common.holder'), value: userLink(w.ownerId) },
          { label: i18n.t('common.status'), value: <StatusBadge value={w.status} map={walletStatus} /> },
          { label: i18n.t('admin.operations.opened'), value: formatDateTime(w.createdAt) },
        ],
      }
    }
  }
}

/**
 * The API looks operations up by type and has no search across them, so "all" asks for the id under every type.
 * A 404 only means "not this type"; anything else (no permission, server down) is a real error, unless another
 * type did find the operation.
 */
async function findOperations(kind: Kind, id: string) {
  const types = kind === 'all' ? operationKinds : [kind]
  const results = await Promise.allSettled(types.map((type) => fetchOperation(type, id)))
  const found = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  const failure = results.find((r) => r.status === 'rejected' && !(r.reason instanceof ApiError && r.reason.status === 404))
  if (found.length === 0 && failure?.status === 'rejected') throw failure.reason
  return found
}

function OperationDetail({ kind, id }: { kind: Kind; id: string }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['admin', 'operation', kind, id],
    retry: false,
    queryFn: () => findOperations(kind, id),
  })

  if (query.isPending) return <Skeleton className="h-48 rounded-xl" />
  if (query.isError) return <AdminError error={query.error} />
  if (query.data.length === 0) {
    return (
      <Card>
        <EmptyState icon={SearchX} title={t('admin.operations.notFoundTitle')}
          description={t(kind === 'all' ? 'admin.operations.notFoundAll' : 'admin.operations.notFoundKind')} />
      </Card>
    )
  }
  return query.data.map((found) => {
    const op = describeOperation(found)
    return (
      <Card key={found.kind}>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{op.title}</p>
            <CardTitle className="text-2xl tabular">{formatMoney(op.amount)}</CardTitle>
          </div>
          {op.status && <StatusBadge value={op.status} map={operationStatus} />}
        </CardHeader>
        <CardContent>
          <DetailGrid rows={[{ label: t('common.identifier'), value: <IdCell id={id} /> }, ...op.rows]} />
        </CardContent>
      </Card>
    )
  })
}

const TOTAL_KINDS = ['transfer', 'deposit', 'withdrawal'] as const

/**
 * What the page shows before a lookup: how much moved this week, by kind and currency, and the deposits and
 * withdrawals still waiting, the oldest first since those are the ones most likely stuck.
 */
function OperationsOverview() {
  const { t } = useTranslation()
  const totals = useQuery({
    queryKey: ['admin', 'operations', 'totals', 7],
    queryFn: () => unwrap(api.GET('/api/v1/admin/operations/totals', { params: { query: { days: 7 } } })),
  })
  const pending = useQuery({
    queryKey: ['admin', 'operations', 'pending'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/operations/pending', { params: { query: { limit: 50 } } })),
  })
  const items = pending.data ?? []

  return (
    <>
      <section aria-label={t('admin.operations.totalsLabel')} className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('admin.operations.overviewTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TOTAL_KINDS.map((kind) => {
            const rows = (totals.data ?? []).filter((row) => row.kind === kind)
            const count = rows.reduce((sum, row) => sum + (row.count ?? 0), 0)
            return (
              <div key={kind} className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t(`admin.operations.${kind}`)}</p>
                {totals.isPending ? <Skeleton className="mt-2 h-7 w-24" /> : (
                  <>
                    <p className="mt-1 text-2xl font-semibold tracking-tight tabular">
                      {count === 0 ? t('admin.operations.nothingYet') : t('admin.operations.operationsCount', { count })}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground tabular">
                      {rows.map((row) => <li key={row.amount?.currency}>{formatMoney(row.amount)} {row.amount?.currency}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )
          })}
        </div>
        {totals.isError && <AdminError error={totals.error} onRetry={() => totals.refetch()} />}
      </section>
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle>{t('admin.operations.pendingTitle')}</CardTitle>
          <CardDescription>{t('admin.operations.pendingHint')}</CardDescription>
        </CardHeader>
        {pending.isError ? <AdminError error={pending.error} onRetry={() => pending.refetch()} />
          : pending.isPending ? <div className="p-5"><Skeleton className="h-24" /></div>
            : items.length === 0 ? (
              <EmptyState icon={CircleCheck} title={t('admin.operations.pendingEmpty')} description={t('admin.operations.pendingEmptyHint')} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('common.type')}</TableHead>
                    <TableHead>{t('admin.operations.user')}</TableHead>
                    <TableHead>{t('common.amount')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.operations.waitingSince')}</TableHead>
                    <TableHead className="pr-5 text-right"><span className="sr-only">{t('admin.operations.view')}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="pl-5 font-medium">{t(`admin.operations.${op.kind === 'withdrawal' ? 'withdrawal' : 'deposit'}`)}</TableCell>
                      <TableCell><IdCell id={op.userId} to={`/admin/users/${op.userId}`} /></TableCell>
                      <TableCell className="tabular">{formatMoney(op.amount)}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{formatDateTime(op.createdAt)}</TableCell>
                      <TableCell className="pr-5 text-right">
                        <Link to={`/admin/operations?type=${op.kind}&id=${op.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                          {t('admin.operations.view')}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
      </Card>
    </>
  )
}

export function AdminOperationsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  // No filter unless the administrator picks one, or the link carries a type this page knows
  const kind = kinds.find((k) => k === params.get('type')) ?? 'all'
  const id = params.get('id') ?? ''
  const [draft, setDraft] = useState(id)
  const [draftKind, setDraftKind] = useState<Kind>(kind)
  // A partial id is a search in progress: it only counts as invalid when it can't be the start of one
  const invalid = draft.trim() !== '' && !uuid.test(draft.trim())
  const showInvalid = draft.trim() !== '' && !/^[0-9a-f-]{1,36}$/i.test(draft.trim())

  // Nothing left to suggest for a complete id
  const preview = useSuggestions(['admin-operations', draftKind], invalid ? draft : '', async (text, signal) => {
    if (showInvalid) return []
    const q = text.toLowerCase()
    const operations = draftKind === 'wallet' ? [] : await unwrap(api.GET('/api/v1/admin/operations/suggestions', {
      params: { query: { q, kind: draftKind === 'all' ? undefined : draftKind } },
      signal,
    }))
    const wallets = draftKind !== 'wallet' && draftKind !== 'all' ? [] : await unwrap(api.GET('/api/v1/admin/wallets/suggestions', {
      params: { query: { q } },
      signal,
    }))
    const rows = [
      ...operations.map((o) => ({ id: o.id!, kind: o.kind as OperationKind, createdAt: o.createdAt, aside: formatMoney(o.amount) })),
      ...wallets.map((w) => ({ id: w.id!, kind: 'wallet' as const, createdAt: w.createdAt, aside: formatMoney(w.balance) })),
    ].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    return rows.map((row) => ({
      value: row.id,
      // The id alone doesn't say which kind a picked row is, and the lookup goes straight to that kind
      meta: row.kind,
      title: row.id,
      detail: `${t(`admin.operations.${row.kind}`)} · ${formatDateTime(row.createdAt)}`,
      aside: row.aside,
    }))
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.operations.title')} description={t('admin.operations.description')} />
      <Card>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (invalid || !draft.trim()) return
              setParams(draftKind === 'all' ? { id: draft.trim() } : { type: draftKind, id: draft.trim() })
            }}>
            <Select value={draftKind} onValueChange={(v) => setDraftKind(v as Kind)} options={kinds.map((value) => ({ value, label: t(`admin.operations.${value}`) }))} className="h-10 sm:w-48" aria-label={t('common.type')} />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <SuggestInput placeholder={t('admin.operations.placeholder')} value={draft} onValueChange={setDraft}
                aria-invalid={showInvalid || undefined} inputClassName="h-10 pl-9 font-mono text-sm" aria-label={t('common.identifier')}
                suggestions={preview.suggestions} loading={preview.loading} noMatches={preview.settled}
                onPick={(picked) => {
                  setDraftKind(picked.meta as Kind)
                  setParams({ type: picked.meta!, id: picked.value })
                }} />
            </div>
            <Button type="submit" size="lg" disabled={!draft.trim() || invalid}>{t('admin.operations.lookup')}</Button>
          </form>
          {showInvalid && <p className="mt-2 text-xs text-destructive">{t('admin.operations.invalidId')}</p>}
        </CardContent>
      </Card>
      {id ? <OperationDetail key={kind + id} kind={kind} id={id} /> : <OperationsOverview />}
    </div>
  )
}
