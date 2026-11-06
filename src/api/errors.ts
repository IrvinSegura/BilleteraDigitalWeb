import i18n, { type MessageKey } from '@/i18n'
import { formatDateTime } from '@/lib/format'

/** The API answers every error with an RFC 9457 ProblemDetail carrying a stable code; validation adds violations. */
export interface Problem {
  status?: number
  detail?: string
  code?: string
  correlationId?: string
  violations?: { field: string; message: string }[]
}

/**
 * A failed API call. code is the API's stable error code (e.g. INVALID_CREDENTIALS), to branch on; show
 * errorMessage(error) to the user. fieldErrors holds the validation messages by field.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly correlationId: string | undefined
  readonly fieldErrors: Record<string, string>

  constructor(status: number, problem: Problem | undefined) {
    super(problem?.detail ?? i18n.t('errors.requestFailed', { status }))
    this.name = 'ApiError'
    this.status = status
    this.code = problem?.code
    this.correlationId = problem?.correlationId
    this.fieldErrors = Object.fromEntries((problem?.violations ?? []).map((v) => [v.field, v.message]))
  }
}

/** The API didn't answer in time, so the call was given up on. */
export class RequestTimeoutError extends Error {
  constructor() {
    super('The API took too long to answer')
    this.name = 'RequestTimeoutError'
  }
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code
}

/** The API refused the new password itself (length, too easy to guess, or leaked): its message goes under that field. */
export function isPasswordRejected(error: unknown): boolean {
  return ['WEAK_PASSWORD', 'COMMON_PASSWORD', 'BREACHED_PASSWORD'].some((code) => hasCode(error, code))
}

// The API's details are in English: known codes get their own message in the active language, built from the
// detail's numbers when it carries some (limits, dates); anything else gets one for its status.
function grab(detail: string, pattern: RegExp): string[] {
  return detail.match(pattern)?.slice(1) ?? []
}

const detailMessages: Record<string, (detail: string) => string> = {
  INVALID_PROFILE: (d) => i18n.t(d.includes('phone') ? 'errors.details.invalidPhone' : 'errors.details.invalidName'),
  WALLET_ALREADY_EXISTS: (d) =>
    i18n.t('errors.details.walletExists', { currency: grab(d, /in (\w{3})/)[0] ?? i18n.t('errors.details.thatCurrency') }),
  DAILY_LIMIT_EXCEEDED: (d) => {
    const [limit, left] = grab(d, /limit of (\S+) reached; you can still send (\S+)/)
    return limit ? i18n.t('errors.details.dailyLimit', { limit, left }) : i18n.t('errors.details.dailyLimitGeneric')
  },
  DEPOSIT_TOO_LARGE: (d) =>
    i18n.t('errors.details.depositTooLarge', { max: grab(d, /at most (.+)$/)[0] ?? i18n.t('errors.details.allowedLimit') }),
  RECIPIENT_NOT_FOUND: (d) =>
    i18n.t('errors.details.recipientNotFound', {
      currency: grab(d, /with a (\w{3}) wallet/)[0] ?? i18n.t('errors.details.thatCurrency'),
    }),
  BANK_ACCOUNT_LIMIT_REACHED: (d) =>
    i18n.t('errors.details.bankAccountLimit', { max: grab(d, /at most (\d+)/)[0] ?? i18n.t('errors.details.some') }),
  // The reason closes the detail ("... cannot be closed: BALANCE") and says what to do first
  ACCOUNT_CANNOT_BE_CLOSED: (d) => {
    const key = `errors.details.cannotClose.${grab(d, /: (\w+)$/)[0] ?? ''}`
    return i18n.exists(key) ? i18n.t(key as MessageKey) : i18n.t('errors.codes.ACCOUNT_CANNOT_BE_CLOSED')
  },
  BANK_ACCOUNT_COOLING_OFF: (d) => {
    const [from] = grab(d, /from (\S+)$/)
    return from && !Number.isNaN(new Date(from).getTime())
      ? i18n.t('errors.details.coolingOff', { date: formatDateTime(from) })
      : i18n.t('errors.details.coolingOffGeneric')
  },
}

const statusMessages: Partial<Record<number, MessageKey>> = {
  400: 'errors.status.badRequest',
  401: 'errors.status.unauthorized',
  403: 'errors.status.forbidden',
  404: 'errors.status.notFound',
  409: 'errors.status.conflict',
  422: 'errors.status.unprocessable',
  423: 'errors.codes.ACCOUNT_LOCKED',
  429: 'errors.codes.RATE_LIMITED',
}

function codeMessage(code: string, detail: string): string | undefined {
  const build = detailMessages[code]
  if (build) {
    return build(detail)
  }
  const key = `errors.codes.${code}`
  return i18n.exists(key) ? i18n.t(key as MessageKey) : undefined
}

/** The message for a code the API stored rather than answered (why it refused a paid deposit), if it is a known one. */
export function storedCodeMessage(code: string | undefined): string | undefined {
  return code ? codeMessage(code, '') : undefined
}

/** Message for a form, alert or toast; network failures (API down or offline) get their own hint. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500 && !error.code?.endsWith('_UNAVAILABLE')) {
      return i18n.t('errors.server')
    }
    const known = error.code ? codeMessage(error.code, error.message) : undefined
    const statusKey = statusMessages[error.status]
    return known ?? (statusKey ? i18n.t(statusKey) : i18n.t('errors.generic'))
  }
  if (error instanceof RequestTimeoutError) {
    return i18n.t('errors.timeout')
  }
  if (error instanceof TypeError) {
    return i18n.t('errors.network')
  }
  return i18n.t('errors.generic')
}

/** No answer came, so what was asked may or may not have happened: the API could have done it just before that. */
export function outcomeUnknown(error: unknown): boolean {
  return error instanceof RequestTimeoutError || error instanceof TypeError
}

/** Message for money that failed to move. Without an answer it can't say it didn't, and starting over could send it twice. */
export function moneyErrorMessage(error: unknown): string {
  return outcomeUnknown(error) ? i18n.t('errors.moneyOutcomeUnknown') : errorMessage(error)
}
