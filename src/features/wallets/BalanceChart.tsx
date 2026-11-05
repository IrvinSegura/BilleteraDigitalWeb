import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatCalendarDay, formatCompact, formatMoney } from '@/lib/format'

import { type BalanceHistory, type BalancePoint, isFlatAtZero, toSeries } from './balance-series'

/** Closing balance of each day of the history, today's being the balance so far. */
export function BalanceChart({ history, currency }: { history: BalanceHistory | undefined; currency: string }) {
  const { t } = useTranslation()
  const data = toSeries(history)
  if (isFlatAtZero(data)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t('wallets.chart.empty')}
      </div>
    )
  }
  return (
    <div className="h-56 w-full" role="img" aria-label={t('wallets.chart.label')}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            // Written inline so the axes follow a change of language
            tickFormatter={(date: string) => formatCalendarDay(date)}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            width={44}
            tickFormatter={(value: number) => formatCompact(value)}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as BalancePoint | undefined
              if (!active || !point) return null
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground">{t('wallets.chart.closeOf', { date: formatCalendarDay(point.date) })}</p>
                  <p className="font-semibold tabular">{formatMoney(point.money ?? { amount: '0', currency })}</p>
                </div>
              )
            }}
          />
          <Area type="monotone" dataKey="balance" stroke="var(--chart-1)" strokeWidth={2} fill="url(#balance-fill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
