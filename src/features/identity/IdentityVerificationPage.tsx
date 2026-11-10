import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Camera, Clock, IdCard, ImagePlus, Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { keys, useIdentityVerification } from '@/api/queries'
import { ErrorState, FormError } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { type MessageKey } from '@/i18n'
import { useRetranslateErrors } from '@/i18n/use-retranslate-errors'
import { formatDateTime } from '@/lib/format'
import { message } from '@/lib/validation'
import { cn } from '@/lib/utils'

import {
  codesAgree, isAcceptedPhoto, isValidCurp, isValidVoterKey, MAX_VALIDITY_YEARS, NAME, NINE_DIGITS, normalizeCode,
  PHOTO_TYPES,
} from './ine'

type Side = 'front' | 'back' | 'selfie'
const SIDES: Side[] = ['front', 'back', 'selfie']

const thisYear = () => new Date().getFullYear()

const name = z.string().trim().min(1, message('identity.errors.required')).regex(NAME, message('identity.errors.name'))

const schema = z.object({
  firstNames: name,
  firstSurname: name,
  secondSurname: z.string().trim().refine((v) => v === '' || NAME.test(v), message('identity.errors.name')),
  curp: z.string().transform(normalizeCode).refine(isValidCurp, message('identity.errors.curp')),
  voterKey: z.string().transform(normalizeCode).refine(isValidVoterKey, message('identity.errors.voterKey')),
  cic: z.string().trim().regex(NINE_DIGITS, message('identity.errors.nineDigits')),
  citizenId: z.string().trim().regex(NINE_DIGITS, message('identity.errors.nineDigits')),
  expiryYear: z.string().trim().refine((v) => {
    const year = Number(v)
    return Number.isInteger(year) && year >= thisYear() && year <= thisYear() + MAX_VALIDITY_YEARS
  }, { error: () => message('identity.errors.expiry', { min: thisYear(), max: thisYear() + MAX_VALIDITY_YEARS }).error() }),
}).refine((v) => !isValidCurp(v.curp) || !isValidVoterKey(v.voterKey) || codesAgree(v.curp, v.voterKey), {
  path: ['voterKey'],
  ...message('errors.details.identity.DATA_MISMATCH'),
})

type Values = z.input<typeof schema>

const statusIcons: Record<string, { icon: typeof ShieldCheck; tone: string }> = {
  NOT_STARTED: { icon: IdCard, tone: 'bg-muted text-muted-foreground' },
  PENDING_REVIEW: { icon: Clock, tone: 'bg-warning/15 text-warning-foreground dark:text-warning' },
  VERIFIED: { icon: BadgeCheck, tone: 'bg-success/12 text-success' },
  REJECTED: { icon: ShieldAlert, tone: 'bg-destructive/10 text-destructive' },
}

function useObjectUrl(file: File | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!file) {
      setUrl(undefined)
      return undefined
    }
    const created = URL.createObjectURL(file)
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [file])
  return url
}

/**
 * One photo: on a phone `capture` opens the camera straight away (the back one for the card, the front one for the
 * face); elsewhere it is a file picker. Nothing leaves the device until the form is sent.
 */
function PhotoInput({ side, file, error, onChange }: {
  side: Side
  file: File | undefined
  error: string | undefined
  onChange: (file: File | undefined) => void
}) {
  const { t } = useTranslation()
  const preview = useObjectUrl(file)
  const inputId = `identity-${side}`
  const selfie = side === 'selfie'
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium" id={`${inputId}-label`}>{t(`identity.${side}`)}</span>
      <div className={cn('relative flex aspect-[1.586] items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40',
        selfie && 'aspect-square', error && 'border-destructive')}>
        {preview ? (
          <>
            <img src={preview} alt={t(`identity.${side}`)} className="size-full object-cover" />
            <Button type="button" variant="secondary" size="icon-sm" className="absolute top-2 right-2"
              aria-label={t('identity.remove')} onClick={() => onChange(undefined)}>
              <X />
            </Button>
          </>
        ) : (
          <label htmlFor={inputId} className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground hover:bg-muted/70">
            {selfie ? <Camera className="size-6" /> : <ImagePlus className="size-6" />}
            {t(selfie ? 'identity.takePhoto' : 'identity.choose')}
          </label>
        )}
        <input id={inputId} type="file" className="sr-only" accept={PHOTO_TYPES.join(',')}
          capture={selfie ? 'user' : 'environment'} aria-labelledby={`${inputId}-label`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange(event.target.files?.[0])
            // The same file can be picked again after removing it
            event.target.value = ''
          }} />
      </div>
      {file && !error && (
        <label htmlFor={inputId} className="cursor-pointer text-xs font-medium text-primary hover:underline">{t('identity.change')}</label>
      )}
      {error
        ? <p className="text-xs text-destructive" role="alert">{error}</p>
        : selfie && <p className="text-xs text-muted-foreground">{t('identity.selfieHint')}</p>}
    </div>
  )
}

function VerificationForm({ attemptsLeft }: { attemptsLeft: number | undefined }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstNames: '', firstSurname: '', secondSurname: '', curp: '', voterKey: '', cic: '', citizenId: '', expiryYear: '' },
  })
  useRetranslateErrors(form)
  const [photos, setPhotos] = useState<Partial<Record<Side, File>>>({})
  const [photoErrors, setPhotoErrors] = useState<Partial<Record<Side, string>>>({})
  const send = useMutation({
    mutationFn: (values: z.output<typeof schema>) => {
      const body = new FormData()
      for (const [key, value] of Object.entries(values)) {
        if (value !== '') body.append(key, String(value))
      }
      for (const side of SIDES) body.append(side, photos[side]!)
      // The API's description lists the fields as parameters, but they always travel in the form body: in the
      // address they would end up in logs, and the API refuses them there
      return unwrap(api.POST('/api/v1/users/me/identity-verification', { body: {} as never, bodySerializer: () => body } as never))
    },
    onSuccess: (status) => {
      queryClient.setQueryData(keys.identity, status)
      toast.success(t('identity.submitted'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const pick = (side: Side, file: File | undefined) => {
    setPhotos((current) => ({ ...current, [side]: file }))
    setPhotoErrors((current) => ({ ...current, [side]: file && !isAcceptedPhoto(file) ? t('identity.errors.photoType') : undefined }))
  }
  const submit = form.handleSubmit((values) => {
    const missing = Object.fromEntries(SIDES.map((side) => [side,
      !photos[side] ? t('identity.errors.photo') : !isAcceptedPhoto(photos[side]) ? t('identity.errors.photoType') : undefined]))
    setPhotoErrors(missing)
    if (Object.values(missing).some(Boolean)) return
    send.mutate(schema.parse(values))
  }, () => {
    // The photos are checked together with the fields, so every problem shows at once
    setPhotoErrors(Object.fromEntries(SIDES.map((side) => [side, photos[side] ? photoErrors[side] : t('identity.errors.photo')])))
  })
  const { errors } = form.formState
  const field = (key: keyof Values, label: MessageKey, extra: { hint?: ReactNode; className?: string; input?: object } = {}) => (
    <FormField label={t(label)} error={errors[key]?.message} hint={extra.hint} className={extra.className}>
      {(props) => <Input {...props} {...extra.input} {...form.register(key)} />}
    </FormField>
  )
  const codeInput = { maxLength: 18, autoCapitalize: 'characters', autoComplete: 'off', spellCheck: false, className: 'font-mono uppercase' }
  const digitsInput = { maxLength: 9, inputMode: 'numeric', autoComplete: 'off', className: 'font-mono' }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('identity.dataTitle')}</CardTitle>
          <CardDescription>{t('identity.dataHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {field('firstNames', 'identity.firstNames', { input: { autoComplete: 'given-name', maxLength: 60 } })}
          {field('firstSurname', 'identity.firstSurname', { input: { autoComplete: 'family-name', maxLength: 60 } })}
          {field('secondSurname', 'identity.secondSurname', { input: { autoComplete: 'off', maxLength: 60 } })}
          {field('curp', 'identity.curp', { hint: t('identity.curpHint'), className: 'sm:col-span-3 md:col-span-1', input: codeInput })}
          {field('voterKey', 'identity.voterKey', { hint: t('identity.voterKeyHint'), className: 'sm:col-span-3 md:col-span-1', input: codeInput })}
          {field('expiryYear', 'identity.expiryYear', {
            hint: t('identity.expiryHint', { year: thisYear() + 5 }),
            className: 'sm:col-span-3 md:col-span-1',
            input: { inputMode: 'numeric', maxLength: 4, autoComplete: 'off' },
          })}
          {field('cic', 'identity.cic', { hint: t('identity.cicHint'), className: 'sm:col-span-3 md:col-span-1', input: digitsInput })}
          {field('citizenId', 'identity.citizenId', { hint: t('identity.citizenIdHint'), className: 'sm:col-span-3 md:col-span-2', input: digitsInput })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('identity.photosTitle')}</CardTitle>
          <CardDescription>{t('identity.photosHint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-[1fr_1fr_0.7fr]">
          {SIDES.map((side) => (
            <PhotoInput key={side} side={side} file={photos[side]} error={photoErrors[side]} onChange={(file) => pick(side, file)} />
          ))}
        </CardContent>
        <CardFooter className="mt-2 flex-col items-stretch gap-4">
          <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" /> {t('identity.privacy')}
          </p>
          <FormError message={send.isError ? errorMessage(send.error) : null} />
          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
            {attemptsLeft !== undefined && (
              <p className="text-xs text-muted-foreground">{t('identity.attemptsLeft', { count: attemptsLeft })}</p>
            )}
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={send.isPending}>
              {send.isPending && <Loader2 className="animate-spin" />} {t('identity.submit')}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  )
}

/** The customer's identity check: where it stands and, until it is approved, the form to send their INE. */
export function IdentityVerificationPage() {
  const { t } = useTranslation()
  const verification = useIdentityVerification()
  const data = verification.data
  const status = data?.status ?? 'NOT_STARTED'
  const { icon: Icon, tone } = statusIcons[status] ?? statusIcons.NOT_STARTED!
  const canSend = status === 'NOT_STARTED' || status === 'REJECTED'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('settings.title')}
      </Link>
      <PageHeader title={t('identity.title')} description={t('identity.description')} />
      {verification.isPending ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : verification.isError ? (
        <ErrorState error={verification.error} onRetry={() => void verification.refetch()} />
      ) : (
        <>
          <Card>
            <CardContent className="flex items-start gap-4">
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></span>
              <div className="min-w-0 space-y-1">
                <h2 className="font-semibold" role="status">{t(`identity.status.${status}` as MessageKey)}</h2>
                <p className="text-sm text-muted-foreground">{t(`identity.statusHint.${status}` as MessageKey)}</p>
                {data?.rejectionReason && status === 'REJECTED' && (
                  <p className="text-sm font-medium text-destructive">{t('identity.reason', { reason: data.rejectionReason })}</p>
                )}
                <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  {data?.curpLastFour && <span>{t('identity.curpEnding', { digits: data.curpLastFour })}</span>}
                  {data?.submittedAt && <span>{t('identity.submittedAt', { date: formatDateTime(data.submittedAt) })}</span>}
                  {data?.reviewedAt && <span>{t('identity.reviewedAt', { date: formatDateTime(data.reviewedAt) })}</span>}
                </p>
              </div>
            </CardContent>
          </Card>
          {canSend && (data?.attemptsLeft === 0
            ? <p className="text-sm text-muted-foreground">{t('identity.noAttempts')}</p>
            : <VerificationForm attemptsLeft={data?.attemptsLeft} />)}
        </>
      )}
    </div>
  )
}
