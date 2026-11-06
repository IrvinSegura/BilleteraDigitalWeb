import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useWallets } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { AmountInput } from '@/components/AmountInput'
import { CopyButton } from '@/components/CopyButton'
import { FormField } from '@/components/FormField'
import { QrImage } from '@/components/QrImage'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format'
import { hasMarkup, markupMessage } from '@/lib/plain-text'

import { MAX_CONCEPT, paymentLink } from './payment-link'
import { defaultWalletId, parseAmount, WalletSelect } from './shared'

/**
 * Asks someone for money with a link or a QR code that opens "Enviar dinero" filled in for them. Nothing is stored:
 * the payer reviews the request and sends it like any transfer.
 */
export function RequestDialog({ walletId: preferred, onClose }: { walletId?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const { data: wallets } = useWallets()
  // Until the user picks one: the wallets may still be loading when the dialog opens
  const [pickedWallet, setWalletId] = useState('')
  const walletId = pickedWallet || defaultWalletId(wallets, preferred)
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')

  const currency = wallets?.find((w) => w.id === walletId)?.balance?.currency ?? 'MXN'
  const value = parseAmount(amount)
  const link = paymentLink(window.location.origin, {
    to: user.email, amount: value ? amount : undefined, currency, concept,
  })
  const summary = value ? `${formatMoney({ amount, currency })}${concept.trim() ? ` · ${concept.trim()}` : ''}` : null
  const canShare = typeof navigator.share === 'function'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <DialogHeader>
        <DialogTitle>{t('money.request.title')}</DialogTitle>
        <DialogDescription>
          {t('money.request.description')}
        </DialogDescription>
      </DialogHeader>
      {/* Side by side from tablets up, so the code fits without scrolling */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] md:items-start">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {(wallets?.length ?? 0) > 1 && (
            <FormField label={t('money.request.receiveIn')}>
              {(field) => <WalletSelect {...field} value={walletId} onValueChange={setWalletId} />}
            </FormField>
          )}
          <AmountInput currency={currency} value={amount} onValueChange={setAmount} aria-label={t('money.request.amount')} />
          <FormField label={t('common.conceptOptional')} hint={`${concept.length}/${MAX_CONCEPT}`}
            error={hasMarkup(concept) ? markupMessage() : undefined}>
            {(field) => (
              <Input {...field} maxLength={MAX_CONCEPT} placeholder={t('money.request.conceptPlaceholder')} value={concept}
                onChange={(e) => setConcept(e.target.value)} />
            )}
          </FormField>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-3 rounded-xl border bg-muted/30 p-4">
          <QrImage value={link} alt={t('money.request.qrAlt', { name: user.fullName })} className="size-40" />
          <p className="w-full text-center text-sm">
            <span className="block truncate font-medium">{user.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">{summary ?? t('money.request.payerChooses')}</span>
          </p>
          <div className="flex w-full min-w-0 items-center gap-1 rounded-lg border bg-background px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{link}</span>
            <CopyButton value={link} label={t('money.request.copyLink')} />
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2 sm:flex-row">
        <Button variant="outline" size="lg" className="sm:flex-1" onClick={onClose}>{t('common.done')}</Button>
        {canShare && (
          <Button size="lg" className="sm:flex-1"
            onClick={() => void navigator.share({
              title: t('money.request.shareTitle'),
              text: summary ? t('money.request.shareTextWithSummary', { summary }) : t('money.request.shareText'),
              url: link,
            })
              .catch(() => undefined)}>
            <Share2 /> {t('money.request.share')}
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}
