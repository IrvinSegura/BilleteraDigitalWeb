import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { keys, useWallets } from '@/api/queries'
import { CurrencyIcon, currencyName } from '@/components/CurrencyIcon'
import { FormError } from '@/components/ErrorState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'

// The currencies the API has daily limits and deposit caps for
const currencies: { code: string; noteKey: MessageKey }[] = [
  { code: 'MXN', noteKey: 'wallets.open.mxnNote' },
  { code: 'USD', noteKey: 'wallets.open.usdNote' },
]

export function useOpenWallet() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (currency: string) => unwrap(api.POST('/api/v1/wallets', { body: { currency } })),
    onSuccess: (wallet) => {
      void queryClient.invalidateQueries({ queryKey: keys.wallets })
      toast.success(t('wallets.open.opened', { currency: wallet.balance?.currency }))
    },
  })
}

export function OpenWalletDialog({ trigger }: { trigger?: React.ReactElement }) {
  const { t } = useTranslation()
  const { data: wallets } = useWallets()
  const owned = new Set(wallets?.map((w) => w.balance?.currency))
  const available = currencies.filter((c) => !owned.has(c.code))
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState('')
  const openWallet = useOpenWallet()

  // Nothing is picked for the user, unless a single currency is left to pick
  const chosen = available.some((c) => c.code === currency) ? currency : available.length === 1 ? available[0]!.code : ''
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { openWallet.reset(); setCurrency('') } }}>
      <DialogTrigger render={trigger ?? <Button variant="outline" />}>
        <Plus /> {t('wallets.open.trigger')}
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('wallets.open.title')}</DialogTitle>
          <DialogDescription>{t('wallets.open.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" role="radiogroup" aria-label={t('common.currency')}>
          {currencies.map((c) => {
            const taken = owned.has(c.code)
            return (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={chosen === c.code}
                disabled={taken}
                onClick={() => setCurrency(c.code)}
                className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors enabled:hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60',
                  chosen === c.code && 'border-primary bg-accent/50 ring-1 ring-primary')}
              >
                <CurrencyIcon currency={c.code} className="size-10" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{currencyName(c.code)} <span className="text-muted-foreground">· {c.code}</span></span>
                  <span className="block text-xs text-muted-foreground">{taken ? t('wallets.open.taken') : t(c.noteKey)}</span>
                </span>
                {chosen === c.code && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>
        <FormError message={openWallet.isError ? errorMessage(openWallet.error) : null} />
        <DialogFooter>
          <Button size="lg" className="w-full" disabled={!chosen || openWallet.isPending}
            onClick={() => openWallet.mutate(chosen, { onSuccess: () => { setOpen(false); setCurrency('') } })}>
            {openWallet.isPending && <Loader2 className="animate-spin" />}
            {available.length === 0 ? t('wallets.open.allOpen') : chosen ? t('wallets.open.submit', { currency: chosen }) : t('wallets.open.choose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
