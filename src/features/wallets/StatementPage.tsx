import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown, Loader2, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'

import { useWallet, useWalletSummary } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { ErrorState } from '@/components/ErrorState'
import { currencyName } from '@/components/CurrencyIcon'
import { PrintDocument, PrintFields, PrintSection } from '@/components/PrintDocument'
import { Skeleton } from '@/components/Skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  fetchPeriodMovements, lastDay, localDay, monthOf, monthPeriod, type Period, periodFromParams, periodSlug, periodTitle, shiftMonth,
} from '@/features/statements/statement-data'
import { useStatementDownload } from '@/features/statements/use-statement-download'
import { formatCalendarDate, formatDateTime, formatMoney, shortId } from '@/lib/format'
import { movementLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { currentMonth, today } from './MovementFilterBar'

function usePeriodMovements(walletId: string, period: Period) {
  return useQuery({
    queryKey: ['wallets', walletId, 'statement', period.from, period.to],
    queryFn: () => fetchPeriodMovements(walletId, period),
  })
}

/**
 * One wallet's statement for a month or the days picked on the statements page, laid out to print, and to download
 * as a PDF file. Months before the wallet was opened aren't offered.
 */
export function StatementPage() {
  const { t } = useTranslation()
  const { walletId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const user = useUser()
  const wallet = useWallet(walletId)
  const opened = wallet.data?.createdAt ? localDay(wallet.data.createdAt) : undefined
  const period = periodFromParams(params, monthPeriod(currentMonth()), opened, today())
  const month = monthOf(period)
  const summary = useWalletSummary(walletId, period)
  const movements = usePeriodMovements(walletId, period)
  const error = wallet.error ?? summary.error ?? movements.error
  const currency = wallet.data?.balance?.currency
  const heading = periodTitle(period)
  const download = useStatementDownload()
  const range = t('wallets.statement.period', { from: formatCalendarDate(period.from), to: formatCalendarDate(period.to) })

  return (
    <div className="min-h-dvh bg-muted/40 pb-8 print:min-h-0 print:bg-white print:pb-0">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-4 print:hidden">
        <Link to={`/wallets/${walletId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('common.back')}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {month ? (
            <>
              <Button variant="outline" size="icon-sm" aria-label={t('wallets.statement.previousMonth')}
                disabled={!!opened && lastDay(shiftMonth(month, -1)) < opened}
                onClick={() => setParams({ month: shiftMonth(month, -1) })}>
                <ChevronLeft />
              </Button>
              <span className="min-w-36 text-center text-sm font-medium">{heading}</span>
              <Button variant="outline" size="icon-sm" aria-label={t('wallets.statement.nextMonth')} disabled={month >= currentMonth()}
                onClick={() => setParams({ month: shiftMonth(month, 1) })}>
                <ChevronRight />
              </Button>
            </>
          ) : <span className="text-sm font-medium">{heading}</span>}
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={movements.isPending}>
          <Printer /> {t('wallets.statement.print')}
        </Button>
        <Button size="sm" disabled={!currency || !summary.data || !movements.data || download.isPending}
          onClick={() => download.mutate({
            period, general: false, wallets: [{ id: walletId, currency: currency! }],
            statements: [{
              walletId, currency: currency!, ...summary.data!, movements: movements.data!.items, cut: movements.data!.cut,
            }],
          })}>
          {download.isPending ? <Loader2 className="animate-spin" /> : <FileDown />} {t('wallets.statement.download')}
        </Button>
      </div>

      <div className="mx-auto max-w-4xl print:max-w-none">
        {error ? <ErrorState error={error} onRetry={() => { void summary.refetch(); void movements.refetch() }} /> : (
          <PrintDocument
            kind={t('wallets.statement.kind')}
            reference={heading}
            date={range}
            fileName={currency ? t('wallets.statement.fileName', { currency, month: periodSlug(period) })
              : t('wallets.statement.fileNameNoCurrency', { month: periodSlug(period) })}
            legal={t('wallets.statement.legal', { currency: currency ?? t('wallets.statement.walletCurrency') })}
          >
            <PrintSection title={t('wallets.statement.accountData')}>
              <PrintFields columns={4} fields={[
                { label: t('common.holder'), value: user.fullName },
                { label: t('common.email'), value: user.email },
                { label: t('common.currency'), value: currency && `${currencyName(currency)} (${currency})` },
                { label: t('common.wallet'), value: shortId(walletId).toUpperCase() },
              ]} />
            </PrintSection>

            <PrintSection title={t('wallets.statement.periodSummary')}>
              <div aria-label={t('wallets.statement.monthSummary')} className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
                {([
                  [t('wallets.statement.openingBalance'), summary.data?.openingBalance, ''],
                  [t('wallets.statement.moneyIn'), summary.data?.moneyIn, 'text-emerald-700'],
                  [t('wallets.statement.moneyOut'), summary.data?.moneyOut, 'text-red-700'],
                ] as const).map(([label, money, tone]) => (
                  <div key={label} className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <p className="text-[7pt] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</p>
                    {summary.isPending ? <Skeleton className="mt-1 h-6 w-24" /> : (
                      <p className={cn('text-[13pt] font-semibold tracking-tight tabular-nums', tone || 'text-slate-900')}>{formatMoney(money)}</p>
                    )}
                  </div>
                ))}
                <div className="rounded-lg bg-indigo-950 px-3 py-2.5 text-white">
                  <p className="text-[7pt] font-semibold tracking-[0.12em] text-indigo-200 uppercase">{t('wallets.statement.closingBalance')}</p>
                  {summary.isPending ? <Skeleton className="mt-1 h-6 w-24" /> : (
                    <p className="text-[13pt] font-semibold tracking-tight tabular-nums">{formatMoney(summary.data?.closingBalance)}</p>
                  )}
                </div>
              </div>
            </PrintSection>

            {/* Not a PrintSection: a long table has to be free to break across pages */}
            <section aria-label={t('common.movements')} className="grid gap-2">
              <h2 className="text-[8pt] font-semibold tracking-[0.14em] text-indigo-950 uppercase">
                {movements.data ? t('wallets.statement.movementsCount', { count: movements.data.items.length }) : t('common.movements')}
              </h2>
              {!movements.data ? <Skeleton className="h-48" /> : movements.data.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-slate-500">{t('wallets.statement.empty')}</p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  {/* border-separate because collapsed borders would ignore the header cells' rounded corners. The header repeats on every printed page. */}
                  <table className="w-full min-w-xl border-separate border-spacing-0 text-[8.5pt] print:min-w-0">
                    <thead>
                      <tr className="text-[7pt] tracking-[0.1em] text-white uppercase">
                        <th className="rounded-l-md bg-indigo-950 px-2.5 py-2 text-left font-semibold">{t('common.date')}</th>
                        <th className="bg-indigo-950 px-2.5 py-2 text-left font-semibold">{t('common.concept')}</th>
                        <th className="bg-indigo-950 px-2.5 py-2 text-left font-semibold">{t('common.folio')}</th>
                        <th className="bg-indigo-950 px-2.5 py-2 text-right font-semibold">{t('wallets.statement.moneyOut')}</th>
                        <th className="bg-indigo-950 px-2.5 py-2 text-right font-semibold">{t('wallets.statement.moneyIn')}</th>
                        <th className="rounded-r-md bg-indigo-950 px-2.5 py-2 text-right font-semibold">{t('common.balance')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.data.items.map((m) => (
                        <tr key={`${m.transactionId}-${m.direction}`} className="break-inside-avoid even:bg-slate-50">
                          <td className="border-b border-slate-200 px-2.5 py-1.5 whitespace-nowrap text-slate-600">{formatDateTime(m.createdAt)}</td>
                          <td className="border-b border-slate-200 px-2.5 py-1.5 text-slate-900">
                            {movementLabel(m.type, m.direction)}
                            {(m.counterpartyName || m.description) && (
                              <span className="block text-[7.5pt] text-slate-500">
                                {[m.counterpartyName, m.description].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-200 px-2.5 py-1.5 font-mono text-[7.5pt] text-slate-500 uppercase">{shortId(m.operationId)}</td>
                          <td className="border-b border-slate-200 px-2.5 py-1.5 text-right whitespace-nowrap text-red-700 tabular-nums">
                            {m.direction === 'IN' ? '' : `−${formatMoney(m.amount)}`}
                          </td>
                          <td className="border-b border-slate-200 px-2.5 py-1.5 text-right whitespace-nowrap text-emerald-700 tabular-nums">
                            {m.direction === 'IN' ? `+${formatMoney(m.amount)}` : ''}
                          </td>
                          <td className="border-b border-slate-200 px-2.5 py-1.5 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">{formatMoney(m.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {movements.data?.cut && (
                <p className="text-[8pt] text-slate-500">
                  {t('wallets.statement.cut')}
                </p>
              )}
            </section>
          </PrintDocument>
        )}
      </div>
    </div>
  )
}
