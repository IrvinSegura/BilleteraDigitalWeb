import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { AmountInput } from '@/components/AmountInput'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMinor } from '@/lib/format'
import { labelOf } from '@/lib/labels'
import { cn } from '@/lib/utils'

import { AdminError } from './shared'

const queryKey = ['admin', 'ledger', 'system-accounts']

function ContributionDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState('MXN')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const contribute = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/admin/ledger/capital-contributions', {
      body: { currency, amount: Number(amount), reference: reference.trim(), reason: reason.trim() },
    })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.success(t('admin.ledger.contribution.registered'))
      setOpen(false)
      setAmount('')
      setReference('')
      setReason('')
    },
  })
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) contribute.reset() }}>
      <DialogTrigger render={<Button />}><Plus /> {t('admin.ledger.contribution.trigger')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); contribute.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t('admin.ledger.contribution.title')}</DialogTitle>
            <DialogDescription>{t('admin.ledger.contribution.description')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('common.currency')}>
            {(field) => <Select {...field} value={currency} onValueChange={setCurrency} options={[{ value: 'MXN', label: 'MXN' }, { value: 'USD', label: 'USD' }]} />}
          </FormField>
          <AmountInput currency={currency} value={amount} onValueChange={setAmount} aria-label={t('common.amount')} />
          <FormField label={t('admin.ledger.contribution.reference')}>
            {(field) => <Input {...field} required maxLength={100} placeholder={t('admin.ledger.contribution.referencePlaceholder')} value={reference} onChange={(e) => setReference(e.target.value)} />}
          </FormField>
          <FormField label={t('common.reason')}>
            {(field) => <Input {...field} required maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </FormField>
          <FormError message={contribute.isError ? errorMessage(contribute.error) : null} />
          <DialogFooter>
            <Button type="submit" size="lg" className="w-full" disabled={!Number(amount) || !reference.trim() || !reason.trim() || contribute.isPending}>
              {contribute.isPending && <Loader2 className="animate-spin" />} {t('admin.ledger.contribution.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminLedgerPage() {
  const { t } = useTranslation()
  const accounts = useQuery({ queryKey, queryFn: () => unwrap(api.GET('/api/v1/admin/ledger/system-accounts')) })
  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.ledger.title')} description={t('admin.ledger.description')} actions={<ContributionDialog />} />
      <Card className="gap-0 py-0">
        {accounts.isPending ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : accounts.isError ? (
          <AdminError error={accounts.error} onRetry={() => accounts.refetch()} />
        ) : accounts.data.length === 0 ? (
          <EmptyState icon={Landmark} title={t('admin.ledger.emptyTitle')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{t('admin.ledger.account')}</TableHead>
                <TableHead>{t('common.type')}</TableHead>
                <TableHead>{t('common.currency')}</TableHead>
                <TableHead className="pr-5 text-right">{t('common.balance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">{labelOf('admin.ledger.accounts', a.code ?? '')}</p>
                    <p className="font-mono text-xs text-muted-foreground">{a.code}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{labelOf('admin.ledger.types', a.type ?? '')}</TableCell>
                  <TableCell>{a.currency}</TableCell>
                  <TableCell className={cn('pr-5 text-right font-medium tabular', (a.balanceMinor ?? 0) < 0 && 'text-destructive')}>
                    {formatMinor(a.balanceMinor, a.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
