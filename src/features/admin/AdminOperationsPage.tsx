import { useQuery } from '@tanstack/react-query'
import { FileSearch, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { ApiError } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      {id ? <OperationDetail key={kind + id} kind={kind} id={id} /> : (
        <Card><EmptyState icon={FileSearch} title={t('admin.operations.promptTitle')} description={t('admin.operations.promptHint')} /></Card>
      )}
    </div>
  )
}
