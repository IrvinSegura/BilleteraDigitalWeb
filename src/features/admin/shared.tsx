import { useMutation } from '@tanstack/react-query'
import { Loader2, ShieldAlert } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage, hasCode } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { CopyButton } from '@/components/CopyButton'
import { ErrorState, FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Skeleton } from '@/components/Skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { useSuggestions } from '@/components/SuggestInput'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatCount, shortId } from '@/lib/format'
import { userStatus } from '@/lib/labels'
import { cn } from '@/lib/utils'

const statTones = {
  danger: 'text-destructive',
  warning: 'text-warning-foreground dark:text-warning',
  info: 'text-sky-600 dark:text-sky-400',
}

/**
 * The users that match what is being typed, by email, name or the start of their id. A POST like the search, so the
 * text stays out of access logs. Each row carries the user's id in `meta`.
 *
 * @param valueOf what the field holds once a row is picked
 */
export function useUserSuggestions(
  key: string,
  text: string,
  valueOf: (user: { id?: string; email?: string }) => string,
) {
  return useSuggestions(['admin-users', key], text, async (typed, signal) => {
    const users = await unwrap(api.POST('/api/v1/admin/users/suggestions', { body: { text: typed }, signal }))
    return users.map((user) => ({
      value: valueOf(user),
      meta: user.id!,
      title: user.fullName ?? user.email!,
      detail: user.email!,
      // Only what stands out: most accounts are active
      aside: user.status === 'ACTIVE' ? undefined : <StatusBadge value={user.status} map={userStatus} />,
    }))
  })
}

/**
 * A failed admin query. The API refuses every admin endpoint until the administrator turns two-factor on,
 * so that case gets a way to do it instead of a bare error.
 */
export function AdminError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()
  const { state, logout } = useAuth()
  if (hasCode(error, 'ADMIN_TWO_FACTOR_REQUIRED')) {
    // Two-factor is on but this session started before it was: only a sign-in with a code gets the claim
    if (state.status === 'signed-in' && state.user.twoFactorEnabled) {
      return (
        <Card className="items-center gap-4 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ShieldAlert className="size-6" />
          </div>
          <div className="max-w-md space-y-1">
            <p className="font-medium">{t('admin.error.signInAgainTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('admin.error.signInAgainHint')}</p>
          </div>
          <Button onClick={() => void logout()}>{t('admin.error.signInAgain')}</Button>
        </Card>
      )
    }
    return (
      <Card className="items-center gap-4 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning-foreground dark:text-warning">
          <ShieldAlert className="size-6" />
        </div>
        <div className="max-w-md space-y-1">
          <p className="font-medium">{t('admin.error.enableTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('admin.error.enableHint')}</p>
        </div>
        <Link to="/settings#security" className={buttonVariants()}>{t('admin.error.enable')}</Link>
      </Card>
    )
  }
  return <ErrorState error={error} onRetry={onRetry} />
}

/**
 * A UUID shortened on screen, whole on hover and in the clipboard. With `to`, the id is a link and the copy button
 * stays outside it, so copying does not navigate.
 */
export function IdCell({ id, to }: { id: string | undefined; to?: string }) {
  const { t } = useTranslation()
  if (!id) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-xs" title={id}>
      {to ? <Link to={to} className="text-primary hover:underline">{shortId(id)}</Link> : shortId(id)}
      <CopyButton value={id} label={t('admin.copyId')} />
    </span>
  )
}

/**
 * Admin actions that change someone's account all ask for a reason, which goes to the audit log.
 */
export function ReasonAction({ trigger, title, description, confirmLabel, destructive, onConfirm }: {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const action = useMutation({
    mutationFn: () => onConfirm(reason.trim()),
    onSuccess: () => {
      toast.success(t('admin.done'))
      setOpen(false)
      setReason('')
    },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) action.reset() }}>
      <DialogTrigger render={<Button variant={destructive ? 'destructive' : 'outline'} size="sm" />}>{trigger}</DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); action.mutate() }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FormField label={t('common.reason')} hint={t('admin.reasonHint')}>
            {(field) => (
              <textarea {...field} required autoFocus maxLength={200} rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
            )}
          </FormField>
          <FormError message={action.isError ? errorMessage(action.error) : null} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={!reason.trim() || action.isPending}>
              {action.isPending && <Loader2 className="animate-spin" />} {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The counts at the top of a list, as a row of tiles. While they load, or if they can't be read, the tile shows a
 * placeholder: the list below is what matters, and it reports any failure itself.
 */
export function AdminStats({ label, loading, tiles }: {
  label: string
  loading: boolean
  tiles: { label: string; value: number | undefined; tone?: 'danger' | 'warning' | 'info' }[]
}) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl border bg-card p-4">
          <dt className="truncate text-xs text-muted-foreground">{tile.label}</dt>
          <dd className={cn('mt-1 text-2xl font-semibold tracking-tight tabular', !!tile.value && tile.tone && statTones[tile.tone])}>
            {loading ? <Skeleton className="mt-1 h-7 w-14" /> : tile.value === undefined ? '—' : formatCount(tile.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A list's filters and page, kept in the address so coming back from a record finds the list as it was and a link
 * shows the same thing. A value outside `allowed` counts as no filter, since the API would refuse it.
 */
export function useListParams<K extends string>(allowed: Record<K, readonly string[]>) {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries((Object.keys(allowed) as K[]).map((key) => {
    const value = params.get(key) ?? ''
    return [key, allowed[key].includes(value) ? value : '']
  })) as Record<K, string>
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '', 10) || 0)
  const write = (nextFilters: Record<K, string>, nextPage: number) => setParams(() => {
    const next = new URLSearchParams()
    for (const key of Object.keys(nextFilters) as K[]) {
      if (nextFilters[key]) next.set(key, nextFilters[key])
    }
    if (nextPage > 0) next.set('page', String(nextPage))
    return next
  })
  return {
    filters,
    page,
    // Another filter means other rows: back to the first page
    setFilter: (key: K, value: string) => write({ ...filters, [key]: value }, 0),
    setPage: (next: number) => write(filters, next),
  }
}

export function DetailGrid({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">{r.label}</dt>
          <dd className="truncate text-sm font-medium">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function BooleanPill({ value, yes, no }: { value: boolean | undefined; yes: string; no: string }) {
  return value
    ? <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">{yes}</span>
    : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{no}</span>
}
