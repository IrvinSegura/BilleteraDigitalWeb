import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LogoMark } from '@/components/Logo'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The sheet of a document meant for paper or PDF (receipts, statements). Fixed colors instead of theme tokens: the
 * dark theme must not reach the paper. On screen it looks like the page it prints as.
 *
 * @param kind what the document is, as its heading
 * @param reference what identifies this one under the kind: a folio, a period
 * @param fileName the name the browser offers when saving it as PDF, which it takes from the page title
 * @param legal the fine print over the footer
 */
export function PrintDocument({ kind, reference, date, fileName, legal, children }: {
  kind: string
  reference: ReactNode
  date?: ReactNode
  fileName: string
  legal?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  // The sheet is on screen until it is printed; what matters is that the time doesn't shift between renders
  const [generatedAt] = useState(() => new Date().toISOString())

  useEffect(() => {
    const previous = document.title
    document.title = fileName
    return () => { document.title = previous }
  }, [fileName])

  return (
    <main className="mx-auto grid gap-6 bg-white px-6 py-8 font-sans text-[10pt] leading-snug text-slate-800 shadow-sm sm:rounded-2xl sm:px-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <LogoMark className="size-11" />
            <div className="leading-tight">
              <p className="text-[15pt] font-semibold tracking-tight text-indigo-950">Billetera</p>
              <p className="text-[8pt] text-slate-500">{t('print.tagline')}</p>
            </div>
          </div>
          <div className="grid justify-items-end text-right">
            <h1 className="text-[7.5pt] font-semibold tracking-[0.16em] text-slate-500 uppercase">{kind}</h1>
            <p className="text-[15pt] leading-tight font-semibold text-indigo-950 tabular-nums">{reference}</p>
            {date && <p className="text-[9pt] text-slate-600">{date}</p>}
          </div>
        </div>
        <div className="flex h-1 overflow-hidden rounded-full">
          <span className="w-2/3 bg-indigo-950" />
          <span className="flex-1 bg-indigo-500" />
        </div>
      </header>
      {children}
      <footer className="grid gap-2 border-t border-slate-200 pt-3 text-[7.5pt] text-slate-500 break-inside-avoid">
        {legal && <p className="text-pretty">{legal}</p>}
        <p>{t('print.generatedAt', { date: formatDateTime(generatedAt) })}</p>
      </footer>
    </main>
  )
}

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 break-inside-avoid">
      <h2 className="text-[8pt] font-semibold tracking-[0.14em] text-indigo-950 uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** Label and value boxes: account holder, wallet, counterpart… An empty value shows as a dash. */
export function PrintFields({ fields, columns = 2 }: { fields: { label: string; value: ReactNode }[]; columns?: 2 | 4 }) {
  return (
    <dl className={cn('grid gap-2 sm:grid-cols-2 print:grid-cols-2', columns === 4 && 'lg:grid-cols-4 print:grid-cols-4')}>
      {fields.map(({ label, value }) => (
        <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[7pt] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</dt>
          <dd className="mt-0.5 font-medium break-words text-slate-900">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

const pillTones: Record<string, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
  danger: 'border-red-300 bg-red-50 text-red-800',
  info: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  neutral: 'border-slate-300 bg-slate-100 text-slate-700',
}

/** A status that also reads in black and white, since the word carries it and not only the color. */
export function PrintStatus({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={cn('rounded-full border px-3 py-1 text-[8pt] font-semibold tracking-[0.08em] uppercase', pillTones[tone] ?? pillTones.neutral)}>
      {label}
    </span>
  )
}
