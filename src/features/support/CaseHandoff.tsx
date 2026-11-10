import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Undo2, UserRoundCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { ErrorState, FormError } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/** Once handed over the case is no longer the agent's: back to the inbox, with what may have come to them instead. */
function useCaseHandedOver() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async () => {
    navigate('/support/inbox')
    await queryClient.invalidateQueries({ queryKey: ['support', 'inbox'] })
  }
}

function ReleaseAction({ conversationId, disabled }: { conversationId: string; disabled: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const handedOver = useCaseHandedOver()
  const release = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/release', { params: { path: { conversationId } } })),
    onSuccess: async () => {
      toast.success(t('support.inbox.handoff.released'))
      setOpen(false)
      await handedOver()
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) release.reset() }}>
      <DialogTrigger render={<Button variant="ghost" disabled={disabled} />}><Undo2 /> {t('support.inbox.handoff.release')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('support.inbox.handoff.releaseTitle')}</DialogTitle>
            <DialogDescription>{t('support.inbox.handoff.releaseHint')}</DialogDescription>
          </DialogHeader>
          <FormError message={release.isError ? errorMessage(release.error) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={release.isPending} onClick={() => release.mutate()}>
              {release.isPending && <Loader2 className="animate-spin" />} {t('support.inbox.handoff.release')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TransferAction({ conversationId, disabled }: { conversationId: string; disabled: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const handedOver = useCaseHandedOver()
  const colleagues = useQuery({
    queryKey: ['support', 'inbox', 'colleagues'],
    queryFn: () => unwrap(api.GET('/api/v1/support/agent/colleagues')),
    enabled: open,
    // Who is free changes all the time, and only a free colleague can take the case
    staleTime: 0,
    refetchInterval: open ? 10_000 : false,
  })
  const transfer = useMutation({
    mutationFn: (colleague: Schemas['ColleagueResponse']) => unwrap(api.POST('/api/v1/support/agent/conversations/{conversationId}/transfer', {
      params: { path: { conversationId } }, body: { agentId: colleague.id! },
    })),
    onSuccess: async (_, colleague) => {
      toast.success(t('support.inbox.handoff.transferred', { name: colleague.name }))
      setOpen(false)
      await handedOver()
    },
    // Someone else may have just taken them
    onError: () => void colleagues.refetch(),
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) transfer.reset() }}>
      <DialogTrigger render={<Button variant="ghost" disabled={disabled} />}><UserRoundCheck /> {t('support.inbox.handoff.transfer')}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t('support.inbox.handoff.transferTitle')}</DialogTitle>
            <DialogDescription>{t('support.inbox.handoff.transferHint')}</DialogDescription>
          </DialogHeader>
          {colleagues.isPending ? <ListSkeleton rows={2} /> : colleagues.isError ? (
            <ErrorState error={colleagues.error} onRetry={() => colleagues.refetch()} />
          ) : colleagues.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('support.inbox.handoff.noColleagues')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {colleagues.data.map((colleague) => (
                <li key={colleague.id}>
                  <button type="button" disabled={colleague.busy || transfer.isPending} onClick={() => transfer.mutate(colleague)}
                    aria-label={t('support.inbox.handoff.pick', { name: colleague.name })}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent">
                    <span className="truncate font-medium">{colleague.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t(colleague.busy ? 'support.inbox.handoff.busy' : 'support.inbox.handoff.free')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <FormError message={transfer.isError ? errorMessage(transfer.error) : null} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Gives the case up: back to the queue, or straight to a colleague who is free. */
export function CaseHandoff({ conversationId, disabled }: { conversationId: string; disabled: boolean }) {
  return (
    <>
      <ReleaseAction conversationId={conversationId} disabled={disabled} />
      <TransferAction conversationId={conversationId} disabled={disabled} />
    </>
  )
}
