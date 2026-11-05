import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, LockOpen, Search, ShieldOff, Snowflake, Sun, UserCheck, UserX, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SuggestInput } from '@/components/SuggestInput'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar } from '@/layouts/UserMenu'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { labelOf, userStatus, walletStatus } from '@/lib/labels'

import { AdminError, BooleanPill, DetailGrid, IdCell, ReasonAction, useUserSuggestions } from './shared'

type AdminUser = Schemas['AdminUserResponse']

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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'wallets'] })

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
  const setUser = (next: AdminUser) => queryClient.setQueryData(['admin', 'users', userId], next)
  const path = { params: { path: { userId } } }

  if (user.isPending) return <Skeleton className="h-56 rounded-xl" />
  if (user.isError) return <AdminError error={user.error} onRetry={() => user.refetch()} />
  const u = user.data
  const disabled = u.status === 'DISABLED'

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
            {u.role !== 'ADMIN' && (
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

export function AdminUsersPage() {
  const { t } = useTranslation()
  const { userId } = useParams()
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.users.title')} description={t('admin.users.description')} />
      <Card><CardContent><SearchBox /></CardContent></Card>
      {userId ? <UserDetail key={userId} userId={userId} /> : (
        <Card><EmptyState icon={Users} title={t('admin.users.promptTitle')} description={t('admin.users.promptHint')} /></Card>
      )}
    </div>
  )
}
