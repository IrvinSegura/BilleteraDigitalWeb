import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, CircleAlert, Loader2, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState, FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { ListSkeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { formatDateTime, formatMoney, shortId } from '@/lib/format'
import { labelOf, operationStatus, ticketStatus } from '@/lib/labels'

type Operation = Schemas['OperationResponse']
type Category = NonNullable<Schemas['OpenTicketRequest']['category']>

// What can be escalated without an operation behind it
const ACCOUNT_CATEGORIES: Category[] = ['ACCOUNT_ACCESS', 'IDENTITY', 'OTHER']

// The API's limit for what the agent writes
const MAX_DESCRIPTION = 1000
// An administrator takes minutes, not seconds: no need to ask as often as the chat does
const TICKET_POLL_MS = 10_000

const caseKey = (conversationId: string) => ['support', 'inbox', 'case', conversationId] as const

/** What a ticket is about: the operation it points at, or the part of the account. */
export function TicketSubject({ ticket }: { ticket: Schemas['TicketResponse'] }) {
  return ticket.operationId ? (
    <>{labelOf('support.inbox.kinds', ticket.operationKind ?? '')} <span className="font-mono text-xs">{shortId(ticket.operationId)}</span></>
  ) : <>{labelOf('support.inbox.categories', ticket.category ?? 'OTHER')}</>
}

/** With an operation, the ticket is about it; without one, the agent says what part of the account it is about. */
function EscalateDialog({ conversationId, open, operation, onClose }: {
  conversationId: string
  open: boolean
  operation: Operation | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('ACCOUNT_ACCESS')
  const escalate = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/tickets', {
      params: { path: { conversationId } },
      body: operation
        ? { operationId: operation.id!, description: description.trim() }
        : { category, description: description.trim() },
    })),
    onSuccess: async () => {
      toast.success(t('support.inbox.operations.escalated'))
      setDescription('')
      onClose()
      // The chat shows the customer it went to the administrators
      await queryClient.invalidateQueries({ queryKey: caseKey(conversationId) })
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { onClose(); escalate.reset() } }}>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); escalate.mutate() }}>
          <DialogHeader>
            <DialogTitle>{t(operation ? 'support.inbox.operations.escalateTitle' : 'support.inbox.operations.escalateAccountTitle')}</DialogTitle>
            <DialogDescription>
              {operation && `${labelOf('support.inbox.kinds', operation.kind ?? '')} ${shortId(operation.id)} · ${formatMoney(operation.amount)}. `}
              {t(operation ? 'support.inbox.operations.escalateHint' : 'support.inbox.operations.escalateAccountHint')}
            </DialogDescription>
          </DialogHeader>
          {!operation && (
            <FormField label={t('support.inbox.operations.escalateCategory')}>
              {(field) => (
                <Select id={field.id} value={category} onValueChange={(next) => setCategory(next as Category)}
                  options={ACCOUNT_CATEGORIES.map((value) => ({ value, label: t(`support.inbox.categories.${value}`) }))} />
              )}
            </FormField>
          )}
          <FormField label={t('support.inbox.operations.escalateField')} hint={t('support.inbox.operations.escalateFieldHint')}>
            {(field) => (
              <textarea {...field} required autoFocus maxLength={MAX_DESCRIPTION} rows={4} value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
            )}
          </FormField>
          <FormError message={escalate.isError ? errorMessage(escalate.error) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!description.trim() || escalate.isPending}>
              {escalate.isPending && <Loader2 className="animate-spin" />} {t('support.inbox.operations.escalate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The case's context for the agent: the customer's recent operations, read only, and what was escalated from this
 * case. The agent never moves money nor changes accounts; what needs fixing goes to an administrator as a ticket, tied
 * to the operation or to the part of the account it is about. The operations are only there while the case is the
 * agent's and open.
 */
export function CaseOperations({ conversationId, active }: { conversationId: string; active: boolean }) {
  const { t } = useTranslation()
  const path = { params: { path: { conversationId } } }
  // An operation, or null for a problem with the account itself
  const [escalating, setEscalating] = useState<Operation | null>()
  const tickets = useQuery({
    queryKey: [...caseKey(conversationId), 'tickets'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations/{conversationId}/tickets', path)),
    // While one waits for an administrator, its resolution can arrive at any moment
    refetchInterval: (query) => (query.state.data?.some((ticket) => ticket.status === 'OPEN') ? TICKET_POLL_MS : false),
  })
  const escalated = tickets.data ?? []
  const inReview = new Set(escalated.filter((ticket) => ticket.status === 'OPEN' && ticket.operationId).map((ticket) => ticket.operationId))
  const operations = useQuery({
    queryKey: [...caseKey(conversationId), 'operations'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/conversations/{conversationId}/operations', path)),
    enabled: active,
    // The administrator fixes the money meanwhile, so its status changes too
    refetchInterval: inReview.size > 0 ? TICKET_POLL_MS : false,
  })
  if (!active && escalated.length === 0) return null

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ReceiptText className="size-4" /> {t('support.inbox.operations.title')}</CardTitle>
        <CardDescription>{t('support.inbox.operations.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {escalated.length > 0 && (
          <section aria-label={t('support.inbox.operations.tickets')} className="grid gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('support.inbox.operations.tickets')}</h3>
            <ul className="grid gap-2">
              {escalated.map((ticket) => (
                <li key={ticket.id} className="grid gap-1 rounded-lg border px-3 py-2 text-sm">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium"><TicketSubject ticket={ticket} /></span>
                    <StatusBadge value={ticket.status} map={ticketStatus} />
                  </span>
                  <span className="text-muted-foreground">{ticket.description}</span>
                  {ticket.resolution && (
                    <span>{t('support.inbox.operations.resolution', { resolution: ticket.resolution })}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {active && (operations.isPending ? <ListSkeleton rows={3} /> : operations.isError ? (
          <ErrorState error={operations.error} onRetry={() => operations.refetch()} />
        ) : operations.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('support.inbox.operations.empty')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {operations.data.map((operation) => {
              const kind = labelOf('support.inbox.kinds', operation.kind ?? '')
              return (
                <li key={`${operation.kind}-${operation.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  {/* The whole row on a phone: the amount and status go below instead of squeezing the dates */}
                  <span className="min-w-0 flex-1 basis-full sm:basis-48">
                    <span className="block font-medium">
                      {kind} <span className="font-mono text-xs text-muted-foreground" title={operation.id}>{shortId(operation.id)}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(operation.createdAt)}
                      {operation.closedAt && operation.closedAt !== operation.createdAt && ` → ${formatDateTime(operation.closedAt)}`}
                    </span>
                    {operation.reason && (
                      <span className="block text-xs text-muted-foreground">{t('support.inbox.operations.reason', { reason: operation.reason })}</span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(operation.amount)}</span>
                  <StatusBadge value={operation.status} map={operationStatus} />
                  {inReview.has(operation.id) ? (
                    <span className="text-xs text-muted-foreground">{t('support.inbox.operations.inReview')}</span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEscalating(operation)}
                      aria-label={t('support.inbox.operations.escalateLabel', { kind, id: shortId(operation.id) })}>
                      <ArrowUpRight /> {t('support.inbox.operations.escalate')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        ))}
        {active && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setEscalating(null)}>
              <CircleAlert /> {t('support.inbox.operations.escalateAccount')}
            </Button>
          </div>
        )}
      </CardContent>
      <EscalateDialog conversationId={conversationId} open={escalating !== undefined} operation={escalating ?? undefined} onClose={() => setEscalating(undefined)} />
    </Card>
  )
}
