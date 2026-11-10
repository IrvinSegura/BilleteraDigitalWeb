import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CreditCard, HandCoins, Hourglass, IdCard, Landmark, Scale, Star, Ticket } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { api, unwrap } from '@/api/client'
import { useOpenTicketCount, usePendingAdjustmentCount, usePendingIdentityCount, useProviderTransactionCounts } from '@/api/queries'
import { PageHeader } from '@/components/PageHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Skeleton } from '@/components/Skeleton'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCalendarDate, formatCount, formatDateTime, formatMinor, formatMoney, formatRelative } from '@/lib/format'
import { labelOf } from '@/lib/labels'

import { SignupsChart, StatusBar, VolumeChart } from './AdminHomeCharts'
import { AttentionCell, BAND, ChangeNote, FigureList, HealthRow, HealthVerdict, Kpi, type Tone } from './AdminHomeParts'
import { auditDetails } from './audit-labels'
import { changeBetween, lastDays, movedOn, operationsPerDay, sum, toSignupSeries, toVolumeSeries, usersToday } from './home-series'
import { AdminError } from './shared'

const PERIODS = [7, 30, 90] as const
const DEFAULT_PERIOD = 30
const CURRENCIES = ['MXN', 'USD']
const RECENT_ACTIVITY = 6
// Read more than are shown: people signing in is most of the log and says nothing to an administrator
const ACTIVITY_READ = 50
const ROUTINE_ACTIONS = new Set(['USER_SIGNED_IN'])
// Enough to say "many": the page of operations has its own full list
const PENDING_LIMIT = 50
const COLUMN_HEAD = 'text-[11px] tracking-wider text-muted-foreground uppercase'

function useReads(days: number) {
  // Twice the period, to compare it with the one before
  const compared = days * 2
  return {
    balances: useQuery({
      queryKey: ['admin', 'ledger', 'customer-balances'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/ledger/customer-balances')),
    }),
    users: useQuery({
      queryKey: ['admin', 'users', 'stats'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/users/stats')),
    }),
    wallets: useQuery({
      queryKey: ['admin', 'wallets', 'stats'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/wallets/stats')),
    }),
    daily: useQuery({
      queryKey: ['admin', 'operations', 'daily', compared],
      queryFn: () => unwrap(api.GET('/api/v1/admin/operations/daily', { params: { query: { days: compared } } })),
    }),
    signups: useQuery({
      queryKey: ['admin', 'users', 'signups', compared],
      queryFn: () => unwrap(api.GET('/api/v1/admin/users/signups', { params: { query: { days: compared } } })),
    }),
    support: useQuery({
      queryKey: ['admin', 'support', 'summary'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/support/summary')),
    }),
    bot: useQuery({
      queryKey: ['admin', 'support', 'bot', 'summary', days],
      queryFn: () => unwrap(api.GET('/api/v1/admin/support/bot/summary', { params: { query: { days } } })),
    }),
    reconciliation: useQuery({
      queryKey: ['admin', 'reconciliations', 'latest'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/reconciliations', { params: { query: { limit: 1 } } })),
    }),
    pending: useQuery({
      queryKey: ['admin', 'operations', 'pending', 'home'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/operations/pending', { params: { query: { limit: PENDING_LIMIT } } })),
    }),
    activity: useQuery({
      queryKey: ['admin', 'audit', 'home'],
      queryFn: () => unwrap(api.GET('/api/v1/admin/audit-events', { params: { query: { page: 0, size: ACTIVITY_READ } } })),
    }),
  }
}

function FigureWithCurrency({ value, currency }: { value: string; currency: string }) {
  return <>{value} <span className="text-sm font-medium tracking-normal text-muted-foreground">{currency}</span></>
}

/**
 * Where an administrator lands: the headline figures of the period against the one before, what waits for someone, what
 * moved and whether the books and the provider add up, then customers, accounts, support and the latest activity. Each
 * part reads on its own, so one that fails leaves the others.
 */
export function AdminHomePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const days = PERIODS.find((period) => String(period) === params.get('days')) ?? DEFAULT_PERIOD
  const [currency, setCurrency] = useState('MXN')

  const identity = usePendingIdentityCount(true)
  const tickets = useOpenTicketCount(true)
  const adjustments = usePendingAdjustmentCount(true)
  const payments = useProviderTransactionCounts(true)
  const queries = [identity, tickets, adjustments, payments]
  const counts = [identity.data?.pending, tickets.data?.open, adjustments.data?.pending, payments.data?.unmatched]
  const allFailed = queries.every((query) => query.isError)
  const allClear = queries.every((query) => query.isSuccess) && counts.every((count) => !count)
  const waitingTotal = sum(counts.map((count) => count ?? 0))
  const reads = useReads(days)

  const compared = lastDays(days * 2)
  const previousDates = compared.slice(0, days)
  const dates = compared.slice(days)
  const dailyRows = reads.daily.data ?? []
  const volume = toVolumeSeries(dailyRows, dates, currency)
  const movedPerDay = volume.map(movedOn)
  const moved = sum(movedPerDay)
  const movedBefore = sum(toVolumeSeries(dailyRows, previousDates, currency).map(movedOn))
  const operations = operationsPerDay(dailyRows, dates)
  const operationsBefore = operationsPerDay(dailyRows, previousDates)
  const signups = toSignupSeries(reads.signups.data ?? [], dates)
  const signupsPerDay = signups.map((point) => point.count)
  const signupsBefore = toSignupSeries(reads.signups.data ?? [], previousDates).map((point) => point.count)

  const balance = reads.balances.data?.find((row) => row.currency === currency)
  const otherCurrency = CURRENCIES.find((code) => code !== currency) ?? ''
  const otherBalance = reads.balances.data?.find((row) => row.currency === otherCurrency)
  const walletsWithBalance = sum((reads.balances.data ?? []).map((row) => row.accounts ?? 0))

  const users = reads.users.data
  const closedUsers = Math.max(0, (users?.total ?? 0) - (users?.active ?? 0) - (users?.disabled ?? 0))
  const walletsTotal = reads.wallets.data?.total ?? 0
  const walletsFrozen = reads.wallets.data?.frozen ?? 0
  const support = reads.support.data
  const bot = reads.bot.data

  const activity = (reads.activity.data?.items ?? []).filter((event) => !ROUTINE_ACTIONS.has(event.action ?? '')).slice(0, RECENT_ACTIVITY)
  const latestRun = reads.reconciliation.data?.[0]
  const differences = latestRun?.discrepancies?.length ?? 0
  const pendingItems = reads.pending.data ?? []
  const unmatched = payments.data?.unmatched ?? 0
  const pendingLabel = pendingItems.length >= PENDING_LIMIT ? `${PENDING_LIMIT}+` : formatCount(pendingItems.length)

  const booksTone: Tone | undefined = reads.reconciliation.isError ? undefined : !latestRun ? 'warning' : latestRun.status === 'CONSISTENT' ? 'good' : 'danger'
  const providerTone: Tone | undefined = payments.isError ? undefined : unmatched ? 'warning' : 'good'
  const pendingTone: Tone | undefined = reads.pending.isError ? undefined : pendingItems.length ? 'warning' : 'good'
  const healthReads = [reads.reconciliation, payments, reads.pending]
  const healthIssues = [booksTone, providerTone, pendingTone].filter((tone) => tone !== 'good').length

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.home.title')} description={t('admin.home.description', { date: formatCalendarDate(usersToday()) })} actions={(
        <>
          <SegmentedControl label={t('common.currency')} size="sm" value={currency} onChange={setCurrency}
            options={CURRENCIES.map((code) => ({ value: code, label: code }))} />
          <SegmentedControl label={t('admin.home.period')} size="sm" value={days}
            onChange={(next) => setParams(next === DEFAULT_PERIOD ? {} : { days: String(next) }, { replace: true })}
            options={PERIODS.map((value) => ({ value, label: t('admin.home.periodDays', { days: value }) }))} />
        </>
      )} />
      {allFailed ? (
        <AdminError error={identity.error} onRetry={() => queries.forEach((query) => void query.refetch())} />
      ) : (
        <>
          <dl aria-label={t('admin.home.metrics')} className={`${BAND} sm:grid-cols-2 xl:grid-cols-4`}>
            <Kpi label={t('admin.home.customerMoney')} loading={reads.balances.isPending}
              foot={reads.balances.isError ? t('admin.home.unavailable') : t('admin.home.customerMoneyFoot', {
                count: walletsWithBalance,
                other: `${formatMinor(otherBalance?.balanceMinor ?? 0, otherCurrency)} ${otherCurrency}`,
              })}>
              {reads.balances.isError ? '—' : <FigureWithCurrency value={formatMinor(balance?.balanceMinor ?? 0, currency)} currency={currency} />}
            </Kpi>
            <Kpi label={t('admin.home.moved')} loading={reads.daily.isPending} trend={reads.daily.isError ? undefined : movedPerDay}
              foot={reads.daily.isError ? t('admin.home.unavailable') : <ChangeNote change={changeBetween(moved, movedBefore)} days={days} />}>
              {reads.daily.isError ? '—' : <FigureWithCurrency value={formatMoney({ amount: String(moved), currency })} currency={currency} />}
            </Kpi>
            <Kpi label={t('admin.home.operationsTotal')} loading={reads.daily.isPending} trend={reads.daily.isError ? undefined : operations}
              foot={reads.daily.isError ? t('admin.home.unavailable') : <ChangeNote change={changeBetween(sum(operations), sum(operationsBefore))} days={days} />}>
              {reads.daily.isError ? '—' : formatCount(sum(operations))}
            </Kpi>
            <Kpi label={t('admin.home.signupsTitle')} loading={reads.signups.isPending} trend={reads.signups.isError ? undefined : signupsPerDay}
              foot={reads.signups.isError ? t('admin.home.unavailable') : <ChangeNote change={changeBetween(sum(signupsPerDay), sum(signupsBefore))} days={days} />}>
              {reads.signups.isError ? '—' : formatCount(sum(signupsPerDay))}
            </Kpi>
          </dl>

          <section aria-labelledby="home-attention" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="home-attention" className="text-sm font-semibold">{t('admin.home.attention')}</h2>
              {allClear ? (
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
                  <CircleCheck className="size-3.5 shrink-0 text-success" />
                  <span className="font-medium">{t('admin.home.allClearTitle')}</span>
                  <span className="text-muted-foreground">{t('admin.home.allClearHint')}</span>
                </p>
              ) : waitingTotal > 0 && (
                <p className="text-xs text-muted-foreground">{t('admin.home.attentionCount', { count: waitingTotal })}</p>
              )}
            </div>
            <div className={`${BAND} md:grid-cols-2 xl:grid-cols-4`}>
              <AttentionCell to="/admin/identity" icon={IdCard} title={t('admin.home.identity')} hint={t('admin.home.identityHint')}
                count={identity.data?.pending} loading={identity.isPending} />
              <AttentionCell to="/admin/tickets" icon={Ticket} title={t('admin.home.tickets')} hint={t('admin.home.ticketsHint')}
                count={tickets.data?.open} loading={tickets.isPending} />
              <AttentionCell to="/admin/adjustments" icon={HandCoins} title={t('admin.home.adjustments')} hint={t('admin.home.adjustmentsHint')}
                count={adjustments.data?.pending} loading={adjustments.isPending} />
              <AttentionCell to="/admin/payments?status=UNMATCHED" icon={Scale} title={t('admin.home.unmatched')} hint={t('admin.home.unmatchedHint')}
                count={payments.data?.unmatched} loading={payments.isPending} />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="min-w-0 xl:col-span-2">
              <CardHeader>
                <CardTitle>{t('admin.home.volumeTitle')}</CardTitle>
                <CardDescription>{t('admin.home.volumeHint', { days, currency })}</CardDescription>
              </CardHeader>
              <CardContent>
                {reads.daily.isPending ? <Skeleton className="h-88" />
                  : reads.daily.isError ? <AdminError error={reads.daily.error} onRetry={() => reads.daily.refetch()} />
                    : <VolumeChart data={volume} currency={currency} />}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t('admin.home.healthTitle')}</CardTitle>
                <CardDescription>{t('admin.home.healthHint')}</CardDescription>
                {healthReads.every((read) => read.isSuccess) && <CardAction><HealthVerdict issues={healthIssues} /></CardAction>}
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="grid h-full auto-rows-fr divide-y">
                  <HealthRow to="/admin/reconciliations" icon={Landmark} title={t('admin.home.healthBooks')} loading={reads.reconciliation.isPending}
                    tone={booksTone}
                    status={reads.reconciliation.isError ? t('admin.home.unavailable')
                      : !latestRun ? t('admin.home.healthBooksNever')
                        : latestRun.status === 'CONSISTENT' ? t('admin.home.healthBooksGood')
                          : t('admin.home.healthBooksBad', { count: differences })}
                    detail={latestRun?.startedAt ? formatRelative(latestRun.startedAt) : undefined} />
                  <HealthRow to="/admin/payments" icon={CreditCard} title={t('admin.home.healthProvider')} loading={payments.isPending}
                    tone={providerTone}
                    status={payments.isError ? t('admin.home.unavailable')
                      : unmatched ? t('admin.home.healthProviderBad', { count: unmatched }) : t('admin.home.healthProviderGood')}
                    detail={payments.data?.pending ? t('admin.home.healthProviderPending', { count: payments.data.pending }) : undefined} />
                  <HealthRow to="/admin/operations" icon={Hourglass} title={t('admin.home.healthPending')} loading={reads.pending.isPending}
                    tone={pendingTone}
                    status={reads.pending.isError ? t('admin.home.unavailable')
                      : pendingItems.length ? t('admin.home.healthPendingSome', { count: pendingLabel }) : t('admin.home.healthPendingNone')}
                    detail={pendingItems[0]?.createdAt ? t('admin.home.healthPendingOldest', { when: formatRelative(pendingItems[0].createdAt) }) : undefined} />
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t('admin.home.signupsTitle')}</CardTitle>
                <CardDescription>{t('admin.home.signupsHint', { days })}</CardDescription>
              </CardHeader>
              <CardContent>
                {reads.signups.isPending ? <Skeleton className="h-56" />
                  : reads.signups.isError ? <AdminError error={reads.signups.error} onRetry={() => reads.signups.refetch()} />
                    : <SignupsChart data={signups} />}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>{t('admin.home.accountsTitle')}</CardTitle>
                <CardDescription>{t('admin.home.accountsHint')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                {reads.users.isPending || reads.wallets.isPending ? <Skeleton className="h-52" /> : (
                  <>
                    {reads.users.isError ? <AdminError error={reads.users.error} onRetry={() => reads.users.refetch()} /> : (
                      <StatusBar label={t('admin.home.accountsBar')} segments={[
                        { label: t('admin.home.accountsActive'), value: users?.active ?? 0, className: 'bg-success' },
                        { label: t('admin.home.accountsDisabled'), value: users?.disabled ?? 0, className: 'bg-destructive' },
                        { label: t('admin.home.accountsClosed'), value: closedUsers, className: 'bg-muted-foreground/50' },
                      ]} />
                    )}
                    {reads.wallets.isError ? <AdminError error={reads.wallets.error} onRetry={() => reads.wallets.refetch()} /> : (
                      <StatusBar label={t('admin.home.walletsBar')} segments={[
                        { label: t('admin.home.walletsOperating'), value: Math.max(0, walletsTotal - walletsFrozen), className: 'bg-success' },
                        { label: t('admin.home.walletsFrozen'), value: walletsFrozen, className: 'bg-warning' },
                      ]} />
                    )}
                    {!reads.users.isError && (
                      <FigureList rows={[
                        { label: t('admin.home.unverified'), value: users?.unverified },
                        { label: t('admin.home.admins'), value: users?.admins },
                      ]} />
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 lg:col-span-2 xl:col-span-1">
              <CardHeader>
                <CardTitle>{t('admin.home.supportTitle')}</CardTitle>
                <CardDescription>{t('admin.home.supportHint')}</CardDescription>
                {!!support?.surveys && (
                  <CardAction className="text-right">
                    <p className="flex items-center justify-end gap-1 text-sm font-semibold tabular">
                      <Star className="size-3.5 text-muted-foreground" />
                      <span>{(support.averageScore ?? 0).toFixed(1)} / 5</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{t('admin.home.surveys', { count: support.surveys })}</p>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="grid gap-5">
                {reads.support.isPending ? <Skeleton className="h-52" />
                  : reads.support.isError ? <AdminError error={reads.support.error} onRetry={() => reads.support.refetch()} /> : (
                    <>
                      <FigureList rows={[
                        { label: t('admin.home.supportQueued'), value: support?.queued },
                        { label: t('admin.home.supportAssigned'), value: support?.assigned },
                        { label: t('admin.home.supportWithBot'), value: support?.withBot },
                        { label: t('admin.home.supportResolved'), value: support?.resolved },
                      ]} />
                      {!!bot?.questions && (
                        <StatusBar label={t('admin.home.botBar', { days })} segments={[
                          { label: t('admin.home.botAnswered'), value: bot.answered ?? 0, className: 'bg-chart-1' },
                          { label: t('admin.home.botOther'), value: Math.max(0, bot.questions - (bot.answered ?? 0)), className: 'bg-muted-foreground/50' },
                        ]} />
                      )}
                    </>
                  )}
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>{t('admin.home.activityTitle')}</CardTitle>
              <CardDescription>{t('admin.home.activityHint')}</CardDescription>
              <CardAction>
                <Link to="/admin/audit" className="text-sm font-medium text-primary hover:underline">{t('admin.home.activityAll')}</Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {reads.activity.isPending ? <Skeleton className="h-40" />
                : reads.activity.isError ? <AdminError error={reads.activity.error} onRetry={() => reads.activity.refetch()} />
                  : activity.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('admin.home.activityEmpty')}</p> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={COLUMN_HEAD}>{t('admin.home.activityEvent')}</TableHead>
                          <TableHead className={`${COLUMN_HEAD} hidden md:table-cell`}>{t('admin.home.activityDetail')}</TableHead>
                          <TableHead className={`${COLUMN_HEAD} text-right`}>{t('admin.home.activityWhen')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activity.map((event) => {
                          const details = event.details ? auditDetails(event.action, event.details) : ''
                          return (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium whitespace-normal">
                                {/* A set width: the column of details takes whatever is left */}
                                <div className="w-48 wrap-break-word md:w-72">
                                  {event.action ? labelOf('admin.audit.actions', event.action) : '—'}
                                  {/* One line under the event where there's no room for the column */}
                                  {details && <span className="block truncate text-xs font-normal text-muted-foreground md:hidden">{details}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="hidden w-full max-w-0 truncate text-muted-foreground md:table-cell">{details}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                <time dateTime={event.occurredAt} title={formatDateTime(event.occurredAt)}>{formatRelative(event.occurredAt)}</time>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
