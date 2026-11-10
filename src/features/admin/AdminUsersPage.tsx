import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Headset, Loader2, LockOpen, Search, ShieldOff, Snowflake, Sun, UserCheck, UserX, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { SuggestInput } from '@/components/SuggestInput'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar } from '@/layouts/UserMenu'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { labelOf, userStatus, walletStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { CreateStaffDialog } from './CreateStaffDialog'
import { AdjustmentDialog } from './AdjustmentDialog'
import { AdminError, AdminStats, BooleanPill, DetailGrid, IdCell, ReasonAction, useListParams, useUserSuggestions } from './shared'

type AdminUser = Schemas['AdminUserResponse']

const PAGE_SIZE = 20
const FILTERS = { status: ['ACTIVE', 'DISABLED', 'CLOSED'], role: ['USER', 'SUPPORT', 'ADMIN'] } as const
// A select needs a value for "no filter": the address simply leaves the filter out
const ALL = 'ALL'

function SearchBox() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const search = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/users/search', { body: { email: email.trim() } })),
    onSuccess: (user) => navigate(`/admin/users/${user.id}`),
  })
  const preview = useUserSuggestions('admin-users', email, (user) => user.email!)
  return (
    <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); search.mutate() }}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <SuggestInput required placeholder={t('admin.users.searchPlaceholder')} value={email}
          onValueChange={(next) => { setEmail(next); search.reset() }} inputClassName="h-10 pl-9" aria-label={t('admin.users.searchLabel')}
          suggestions={preview.suggestions} loading={preview.loading} noMatches={preview.settled}
          onPick={(picked) => navigate(`/admin/users/${picked.meta}`)} />
      </div>
      <Button type="submit" size="lg" disabled={!email.trim() || search.isPending}>
        {search.isPending && <Loader2 className="animate-spin" />} {t('common.search')}
      </Button>
      {search.isError && (
        <div className="sm:hidden"><FormError message={hasCode(search.error, 'USER_NOT_FOUND') ? t('admin.users.noneWithEmail') : errorMessage(search.error)} /></div>
      )}
      {search.isError && (
        <p className="hidden self-center text-sm text-destructive sm:block">
          {hasCode(search.error, 'USER_NOT_FOUND') ? t('admin.users.noResults') : errorMessage(search.error)}
        </p>
      )}
    </form>
  )
}

function UserWallets({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const wallets = useQuery({
    queryKey: ['admin', 'users', userId, 'wallets'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/users/{userId}/wallets', { params: { path: { userId } } })),
  })
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'wallets'] }),
    // The platform's list of wallets and its counts changed too
    queryClient.invalidateQueries({ queryKey: ['admin', 'wallets'] }),
  ])

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="border-b pb-4"><CardTitle>{t('common.wallets')}</CardTitle></CardHeader>
      {wallets.isPending ? <div className="p-4"><Skeleton className="h-12" /></div> : wallets.isError ? (
        <AdminError error={wallets.error} onRetry={() => wallets.refetch()} />
      ) : wallets.data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('admin.users.noWallets')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">{t('common.wallet')}</TableHead>
              <TableHead>{t('common.balance')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('admin.users.opened')}</TableHead>
              <TableHead className="pr-5 text-right">{t('admin.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.data.map((w) => {
              const frozen = w.status === 'FROZEN'
              const path = { params: { path: { walletId: w.id! } } }
              return (
                <TableRow key={w.id}>
                  <TableCell className="pl-5"><span className="font-medium">{w.balance?.currency}</span> <IdCell id={w.id} /></TableCell>
                  <TableCell className="font-medium tabular">{formatMoney(w.balance)}</TableCell>
                  <TableCell><StatusBadge value={w.status} map={walletStatus} /></TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(w.createdAt)}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <span className="inline-flex flex-wrap justify-end gap-2">
                      <AdjustmentDialog userId={userId} walletId={w.id} />
                      <ReasonAction
                        trigger={frozen ? <><Sun /> {t('admin.users.unfreeze')}</> : <><Snowflake /> {t('admin.users.freeze')}</>}
                        title={t(frozen ? 'admin.users.unfreezeTitle' : 'admin.users.freezeTitle')}
                        description={t(frozen ? 'admin.users.unfreezeHint' : 'admin.users.freezeHint')}
                        confirmLabel={t(frozen ? 'admin.users.unfreeze' : 'admin.users.freeze')}
                        destructive={!frozen}
                        onConfirm={async (reason) => {
                          await unwrap(frozen
                            ? api.POST('/api/v1/admin/wallets/{walletId}/unfreeze', { ...path, body: { reason } })
                            : api.POST('/api/v1/admin/wallets/{walletId}/freeze', { ...path, body: { reason } }))
                          await refresh()
                        }}
                      />
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function UserDetail({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => unwrap(api.GET('/api/v1/admin/users/{userId}', { params: { path: { userId } } })),
  })
  const setUser = (next: AdminUser) => {
    queryClient.setQueryData(['admin', 'users', userId], next)
    // The list and its counts show this account's state too
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'list'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'stats'] })
  }
  const path = { params: { path: { userId } } }

  if (user.isPending) return <Skeleton className="h-56 rounded-xl" />
  if (user.isError) return <AdminError error={user.error} onRetry={() => user.refetch()} />
  const u = user.data
  const disabled = u.status === 'DISABLED'
  // Its owner closed it: there is nothing left to change
  const closed = u.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={u.fullName ?? '?'} className="size-12" />
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {u.fullName} <StatusBadge value={u.status} map={userStatus} />
              {u.locked && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{t('admin.users.locked')}</span>}
            </CardTitle>
            <p className="truncate text-sm text-muted-foreground">{u.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {u.locked && (
              <ReasonAction trigger={<><LockOpen /> {t('admin.users.unlock')}</>} title={t('admin.users.unlockTitle')}
                description={t('admin.users.unlockHint')}
                confirmLabel={t('admin.users.unlock')}
                onConfirm={async (reason) => {
                  setUser(await unwrap(api.POST('/api/v1/admin/users/{userId}/unlock', { ...path, body: { reason } })))
                }} />
            )}
            {u.twoFactorEnabled && (
              <ReasonAction trigger={<><ShieldOff /> {t('admin.users.resetTwoFactor')}</>} title={t('admin.users.resetTwoFactorTitle')}
                description={t('admin.users.resetTwoFactorHint')}
                confirmLabel={t('admin.users.reset')}
                onConfirm={async (reason) => {
                  await unwrap(api.POST('/api/v1/admin/users/{userId}/two-factor/reset', { ...path, body: { reason } }))
                  await user.refetch()
                }} />
            )}
            {u.role !== 'ADMIN' && !closed && (
              <ReasonAction trigger={<><Headset /> {t(u.role === 'SUPPORT' ? 'admin.users.removeSupport' : 'admin.users.makeSupport')}</>}
                title={t(u.role === 'SUPPORT' ? 'admin.users.removeSupportTitle' : 'admin.users.makeSupportTitle')}
                description={t(u.role === 'SUPPORT' ? 'admin.users.removeSupportHint' : 'admin.users.makeSupportHint')}
                confirmLabel={t(u.role === 'SUPPORT' ? 'admin.users.removeSupport' : 'admin.users.makeSupport')}
                destructive={u.role === 'SUPPORT'}
                onConfirm={async (reason) => setUser(await unwrap(api.POST('/api/v1/admin/users/{userId}/role', {
                  ...path, body: { role: u.role === 'SUPPORT' ? 'USER' : 'SUPPORT', reason },
                })))} />
            )}
            {u.role !== 'ADMIN' && !closed && (
              <ReasonAction
                trigger={disabled ? <><UserCheck /> {t('admin.users.enable')}</> : <><UserX /> {t('admin.users.disable')}</>}
                title={t(disabled ? 'admin.users.enableTitle' : 'admin.users.disableTitle')}
                description={t(disabled ? 'admin.users.enableHint' : 'admin.users.disableHint')}
                confirmLabel={t(disabled ? 'admin.users.enable' : 'admin.users.disable')}
                destructive={!disabled}
                onConfirm={async (reason) => setUser(await unwrap(disabled
                  ? api.POST('/api/v1/admin/users/{userId}/enable', { ...path, body: { reason } })
                  : api.POST('/api/v1/admin/users/{userId}/disable', { ...path, body: { reason } })))}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DetailGrid rows={[
            { label: t('common.identifier'), value: <IdCell id={u.id} /> },
            { label: t('admin.users.role'), value: u.role ? labelOf('labels.roles', u.role) : '—' },
            { label: t('admin.users.joined'), value: formatDateTime(u.createdAt) },
            { label: t('common.email'), value: <BooleanPill value={u.emailVerified} yes={t('admin.users.verifiedOn', { date: formatDate(u.emailVerifiedAt) })} no={t('admin.users.unverified')} /> },
            { label: t('admin.users.twoFactor'), value: <BooleanPill value={u.twoFactorEnabled} yes={t('admin.users.active')} no={t('admin.users.inactive')} /> },
            { label: t('admin.users.lock'), value: u.locked ? t('admin.users.lockedUntil', { date: formatDateTime(u.lockedUntil) }) : t('admin.users.notLocked') },
          ]} />
        </CardContent>
      </Card>
      <UserWallets userId={userId} />
    </div>
  )
}

/** Every account, the newest first, with how many there are of each kind above. */
function UserList() {
  const { t } = useTranslation()
  const { filters, page, setFilter, setPage } = useListParams(FILTERS)
  const { status, role } = filters

  const stats = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => unwrap(api.GET('/api/v1/admin/users/stats')),
  })
  const users = useQuery({
    queryKey: ['admin', 'users', 'list', status, role, page],
    queryFn: () => unwrap(api.GET('/api/v1/admin/users', {
      params: { query: { status: status || undefined, role: role || undefined, page, size: PAGE_SIZE } },
    })),
    placeholderData: keepPreviousData,
  })
  const items = users.data?.items ?? []

  return (
    <>
      <AdminStats label={t('admin.users.statsLabel')} loading={stats.isPending} tiles={[
        { label: t('admin.users.total'), value: stats.data?.total },
        { label: t('admin.users.activeCount'), value: stats.data?.active },
        { label: t('admin.users.disabledCount'), value: stats.data?.disabled, tone: 'danger' },
        { label: t('admin.users.unverifiedCount'), value: stats.data?.unverified, tone: 'warning' },
        { label: t('admin.users.adminsCount'), value: stats.data?.admins },
      ]} />
      <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,16rem))]">
        <FormField label={t('admin.users.statusFilter')}>
          {(field) => (
            <Select {...field} aria-label={t('admin.users.statusFilter')} value={status || ALL}
              onValueChange={(next) => setFilter('status', next === ALL ? '' : next)} options={[
                { value: ALL, label: t('admin.users.allStatuses') },
                { value: 'ACTIVE', label: t('admin.users.statusOptions.ACTIVE') },
                { value: 'DISABLED', label: t('admin.users.statusOptions.DISABLED') },
                { value: 'CLOSED', label: t('admin.users.statusOptions.CLOSED') },
              ]} />
          )}
        </FormField>
        <FormField label={t('admin.users.roleFilter')}>
          {(field) => (
            <Select {...field} aria-label={t('admin.users.roleFilter')} value={role || ALL}
              onValueChange={(next) => setFilter('role', next === ALL ? '' : next)} options={[
                { value: ALL, label: t('admin.users.allRoles') },
                { value: 'USER', label: t('labels.roles.USER') },
                { value: 'SUPPORT', label: t('labels.roles.SUPPORT') },
                { value: 'ADMIN', label: t('labels.roles.ADMIN') },
              ]} />
          )}
        </FormField>
      </div>
      {users.isError ? <AdminError error={users.error} onRetry={() => users.refetch()} /> : (
        <Card className="gap-0 py-0">
          {users.isPending ? <ListSkeleton rows={6} /> : items.length === 0 ? (
            <EmptyState icon={Users} title={t('admin.users.emptyTitle')} description={t('admin.users.emptyHint')} />
          ) : (
            <div className={cn(users.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">{t('admin.users.account')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('admin.users.role')}</TableHead>
                    <TableHead className="hidden pr-5 md:table-cell">{t('admin.users.joined')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-56 pl-5 sm:max-w-none">
                        <Link to={`/admin/users/${u.id}`} className="block truncate font-medium text-primary hover:underline">{u.fullName ?? u.email}</Link>
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge value={u.status} map={userStatus} />
                          {u.locked && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{t('admin.users.locked')}</span>}
                          {!u.emailVerified && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t('admin.users.unverified')}</span>}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{u.role ? labelOf('labels.roles', u.role) : '—'}</TableCell>
                      <TableCell className="hidden pr-5 text-muted-foreground md:table-cell">{formatDate(u.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pager page={page} hasNext={!!users.data?.hasNext} onPageChange={setPage} disabled={users.isFetching} />
        </Card>
      )}
    </>
  )
}

export function AdminUsersPage() {
  const { t } = useTranslation()
  const { userId } = useParams()
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.users.title')} description={t('admin.users.description')} actions={<CreateStaffDialog />} />
      <Card><CardContent><SearchBox /></CardContent></Card>
      {userId ? (
        <>
          <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> {t('admin.users.backToList')}
          </Link>
          <UserDetail key={userId} userId={userId} />
        </>
      ) : <UserList />}
    </div>
  )
}
