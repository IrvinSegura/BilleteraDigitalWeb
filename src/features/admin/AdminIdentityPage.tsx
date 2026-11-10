import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, IdCard, ImageOff, Loader2, ShieldAlert, ShieldX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCalendarDate, formatDateTime } from '@/lib/format'
import { identityStatus, labelOf } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError, BooleanPill, DetailGrid, ReasonAction, useListParams } from './shared'

const PAGE_SIZE = 20
const STATUSES = ['PENDING_REVIEW', 'VERIFIED', 'REJECTED'] as const
const FILTERS = { status: STATUSES } as const
const SIDES = ['front', 'back', 'selfie'] as const
type Side = typeof SIDES[number]

const detailKey = (id: string) => ['admin', 'identity', 'detail', id] as const

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return undefined
    const created = URL.createObjectURL(blob)
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [blob])
  return url
}

/**
 * One photo of the card. It comes with the session's token, so it is fetched and shown from memory instead of
 * linking to it, and nothing keeps a copy: the API forbids caching it.
 */
function DocumentImage({ id, side }: { id: string; side: Side }) {
  const { t } = useTranslation()
  const image = useQuery({
    queryKey: ['admin', 'identity', 'image', id, side],
    queryFn: () => unwrap<Blob>(api.GET('/api/v1/admin/identity-verifications/{id}/images/{side}', {
      params: { path: { id, side: side.toUpperCase() as Uppercase<Side> } },
      parseAs: 'blob',
    }) as never),
    staleTime: Infinity,
    gcTime: 0,
  })
  const url = useObjectUrl(image.data)
  const label = t(`identity.${side}`)
  return (
    <figure className="grid gap-1.5">
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
      <div className={cn('flex items-center justify-center overflow-hidden rounded-xl border bg-muted/40',
        side === 'selfie' ? 'aspect-square' : 'aspect-[1.586]')}>
        {image.isPending ? <Skeleton className="size-full" /> : image.isError || !url ? (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImageOff className="size-5" /> {t('admin.identity.imageError')}
          </span>
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="size-full">
            <img src={url} alt={label} className="size-full object-contain" />
          </a>
        )}
      </div>
    </figure>
  )
}

function ApproveAction({ id, onDone }: { id: string; onDone: () => Promise<unknown> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const approve = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/identity-verifications/{id}/approve', { params: { path: { id } } })),
    onSuccess: async () => {
      toast.success(t('admin.identity.approved'))
      setOpen(false)
      await onDone()
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) approve.reset() }}>
      <DialogTrigger render={<Button size="sm" />}><BadgeCheck /> {t('admin.identity.approve')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.identity.approveTitle')}</DialogTitle>
          <DialogDescription>{t('admin.identity.approveHint')}</DialogDescription>
        </DialogHeader>
        <FormError message={approve.isError ? errorMessage(approve.error) : null} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
            {approve.isPending && <Loader2 className="animate-spin" />} {t('admin.identity.approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VerificationDetail({ id }: { id: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: detailKey(id),
    queryFn: () => unwrap(api.GET('/api/v1/admin/identity-verifications/{id}', { params: { path: { id } } })),
  })
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: detailKey(id) }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'identity', 'list'] }),
  ])

  if (detail.isPending) return <Skeleton className="h-96 w-full rounded-2xl" />
  if (detail.isError) return <AdminError error={detail.error} onRetry={() => detail.refetch()} />
  const v = detail.data
  const pending = v.status === 'PENDING_REVIEW'
  const fullName = [v.firstNames, v.firstSurname, v.secondSurname].filter(Boolean).join(' ')
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{fullName}</CardTitle>
            <Link to={`/admin/users/${v.userId}`} className="block truncate text-sm text-primary hover:underline">{v.userEmail}</Link>
          </div>
          <StatusBadge value={v.status} map={identityStatus} />
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            <BooleanPill value={v.namesMatchCurp} yes={t('admin.identity.namesMatchCurp')} no={t('admin.identity.namesMismatchCurp')} />
            <BooleanPill value={v.nameMatchesAccount} yes={t('admin.identity.nameMatchesAccount')} no={t('admin.identity.nameMismatchAccount')} />
          </div>
          <DetailGrid rows={[
            { label: t('admin.identity.accountName'), value: v.accountName ?? '—' },
            { label: t('admin.identity.curp'), value: <span className="font-mono">{v.curp}</span> },
            { label: t('admin.identity.voterKey'), value: <span className="font-mono">{v.voterKey}</span> },
            { label: t('admin.identity.cic'), value: <span className="font-mono">{v.cic}</span> },
            { label: t('admin.identity.citizenId'), value: <span className="font-mono">{v.citizenId}</span> },
            { label: t('admin.identity.expiryYear'), value: v.expiryYear ?? '—' },
            { label: t('admin.identity.birthDate'), value: v.birthDate ? formatCalendarDate(v.birthDate) : '—' },
            { label: t('admin.identity.sex'), value: v.sex ? labelOf('admin.identity.sexes', v.sex) : '—' },
            { label: t('admin.identity.submitted'), value: formatDateTime(v.submittedAt) },
            ...(v.reviewedAt ? [{ label: t('admin.identity.reviewedAt'), value: formatDateTime(v.reviewedAt) }] : []),
            ...(v.rejectionReason ? [{ label: t('admin.identity.rejectionReason'), value: v.rejectionReason }] : []),
          ]} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t('admin.identity.photos')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_0.7fr]">
          {SIDES.map((side) => <DocumentImage key={side} id={id} side={side} />)}
        </CardContent>
      </Card>
      {pending && (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="flex flex-1 gap-2 text-sm text-muted-foreground">
              <ShieldAlert className="size-4 shrink-0 text-warning-foreground dark:text-warning" /> {t('admin.identity.checklist')}
            </p>
            <div className="flex shrink-0 gap-2">
              <ReasonAction
                trigger={<><ShieldX /> {t('admin.identity.reject')}</>}
                title={t('admin.identity.rejectTitle')}
                description={t('admin.identity.rejectHint')}
                confirmLabel={t('admin.identity.reject')}
                destructive
                onConfirm={async (reason) => {
                  await unwrap(api.POST('/api/v1/admin/identity-verifications/{id}/reject', { params: { path: { id } }, body: { reason } }))
                  await refresh()
                }}
              />
              <ApproveAction id={id} onDone={refresh} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function VerificationList() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  // What waits for someone comes first
  const status = filters.status || 'PENDING_REVIEW'
  const list = useQuery({
    queryKey: ['admin', 'identity', 'list', status, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/identity-verifications', {
      params: { query: { status: status as typeof STATUSES[number], page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = list.data?.items ?? []
  return (
    <>
      <SegmentedControl label={t('admin.identity.statusFilter')} value={status} onChange={(next) => setFilter('status', next)}
        options={STATUSES.map((value) => ({ value, label: t(`labels.identityStatus.${value}`) }))} />
      {list.isError ? <AdminError error={list.error} onRetry={() => list.refetch()} /> : (
        <Card className="gap-0 py-0">
          {list.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={IdCard} title={t('admin.identity.emptyTitle')} description={t('admin.identity.emptyHint')} />
          ) : (
            <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('admin.identity.customer')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('admin.identity.checks')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('admin.identity.curp')}</TableHead>
                    <TableHead className="pr-5">{t('admin.identity.submitted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-56 pl-5 sm:max-w-none">
                        <Link to={`/admin/identity/${v.id}`} className="block truncate font-medium text-primary hover:underline">
                          {v.userName ?? v.userEmail}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">{v.userEmail}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="flex flex-wrap gap-1.5">
                          <BooleanPill value={v.namesMatchCurp} yes={t('admin.identity.namesMatchCurp')} no={t('admin.identity.namesMismatchCurp')} />
                          <BooleanPill value={v.nameMatchesAccount} yes={t('admin.identity.nameMatchesAccount')} no={t('admin.identity.nameMismatchAccount')} />
                        </span>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">•••• {v.curpLastFour}</TableCell>
                      <TableCell className="pr-5 text-muted-foreground">{formatDateTime(v.submittedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={page} hasNext={!!list.data?.hasNext} onPageChange={setPage} disabled={list.isFetching} />
        </Card>
      )}
    </>
  )
}

/** The queue of INE checks customers send, and each one with its photos to approve or reject. */
export function AdminIdentityPage() {
  const { t } = useTranslation()
  const { verificationId } = useParams()
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.identity.title')} description={t('admin.identity.description')} />
      {verificationId ? (
        <>
          <Link to="/admin/identity" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> {t('admin.identity.backToList')}
          </Link>
          <VerificationDetail key={verificationId} id={verificationId} />
        </>
      ) : <VerificationList />}
    </div>
  )
}
