import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { useUser } from '@/auth/auth-context'
import { ErrorState } from '@/components/ErrorState'
import { PrintDocument, PrintFields, PrintSection, PrintStatus } from '@/components/PrintDocument'
import { Skeleton } from '@/components/Skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { saveFile } from '@/lib/download'
import { formatDateTime, formatMoney, shortId } from '@/lib/format'
import { movementLabel, operationStatus, type StatusStyle } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { type DetailRow, operationRows, useOperation } from './operation'
import { drawReceipt } from './receipt-image'

function useMovement(walletId: string, transactionId: string) {
  return useQuery({
    queryKey: ['wallets', walletId, 'movement', transactionId],
    queryFn: () => unwrap(api.GET('/api/v1/wallets/{walletId}/movements/{transactionId}', {
      params: { path: { walletId, transactionId } },
    })),
  })
}

// The phone's share sheet where there is one (with the image attached), a download everywhere else
async function shareOrSave(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (error) {
      // Closing the share sheet is a choice, not an error
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  saveFile(blob, filename)
}

/** One movement's receipt: printable as PDF, or shared as an image. */
export function ReceiptPage() {
  const { t } = useTranslation()
  const { walletId = '', transactionId = '' } = useParams()
  const user = useUser()
  const movement = useMovement(walletId, transactionId)
  const operation = useOperation(movement.data, walletId)
  const [sharing, setSharing] = useState(false)

  const m = movement.data
  const incoming = m?.direction === 'IN'
  const title = movementLabel(m?.type, m?.direction)
  const amount = m ? `${incoming ? '+' : '−'}${formatMoney(m.amount)}` : ''
  const details: DetailRow[] = m ? [...operationRows(m, operation.data), { label: t('common.holder'), value: user.fullName }] : []
  const rows: DetailRow[] = m ? [{ label: t('common.date'), value: formatDateTime(m.createdAt) }, ...details] : []
  // A movement exists once it reached the ledger, so one without a status of its own (a transfer) is already applied
  const status: StatusStyle = operationStatus[details.find((row) => row.status)?.status ?? ''] ?? { labelKey: 'wallets.receipt.applied', tone: 'success' }
  const reference = m?.operationId ?? m?.transactionId ?? ''
  // Details still on their way would be missing from the image
  const ready = !!m && (!m.operationId || !operation.isPending)

  async function share() {
    setSharing(true)
    try {
      const blob = await drawReceipt({
        title, amount, incoming, rows, reference,
        footer: t('print.generatedAt', { date: formatDateTime(new Date().toISOString()) }),
      })
      await shareOrSave(blob, `${t('wallets.receipt.fileName', { folio: shortId(reference) })}.png`, t('wallets.receipt.shareTitle', { title }))
    } catch {
      toast.error(t('wallets.receipt.imageFailed'))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="min-h-dvh bg-muted/40 pb-8 print:min-h-0 print:bg-white print:pb-0">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2 px-4 py-4 print:hidden">
        <Link to={`/wallets/${walletId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> {t('common.back')}
        </Link>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void share()} disabled={!ready || sharing}>
            <Share2 /> {t('wallets.receipt.shareImage')}
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!ready}>
            <Printer /> {t('wallets.receipt.print')}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl print:max-w-none">
        {movement.error ? <ErrorState error={movement.error} onRetry={() => void movement.refetch()} /> : (
          <PrintDocument
            kind={t('wallets.receipt.kind')}
            reference={m ? t('wallets.receipt.folioShort', { folio: shortId(reference).toUpperCase() }) : '—'}
            date={m && formatDateTime(m.createdAt)}
            fileName={t('wallets.receipt.fileName', { folio: shortId(reference) })}
            legal={t('wallets.receipt.legal')}
          >
            {!m ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-40" />
              </div>
            ) : (
              <>
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/70 px-5 py-4 break-inside-avoid">
                  <div>
                    <p className="text-[8pt] font-semibold tracking-[0.14em] text-indigo-950 uppercase">{title}</p>
                    <p className={cn('text-[26pt] leading-tight font-bold tracking-tight tabular-nums', incoming ? 'text-emerald-700' : 'text-slate-900')}>
                      {amount} <span className="text-[11pt] font-medium tracking-normal text-slate-500">{m.amount?.currency}</span>
                    </p>
                  </div>
                  <PrintStatus label={t(status.labelKey)} tone={status.tone} />
                </section>
                <PrintSection title={t('wallets.receipt.details')}>
                  <PrintFields fields={[
                    { label: t('wallets.receipt.movementType'), value: title },
                    { label: t('common.currency'), value: m.amount?.currency },
                    ...details.filter((row) => !row.status),
                  ]} />
                  {operation.isPending && m.operationId && <Skeleton className="h-12" />}
                </PrintSection>
                <PrintSection title={t('wallets.receipt.fullFolio')}>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[9pt] break-all text-slate-700">{reference}</p>
                </PrintSection>
              </>
            )}
          </PrintDocument>
        )}
      </div>
    </div>
  )
}
