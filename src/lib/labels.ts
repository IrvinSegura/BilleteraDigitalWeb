import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Building2,
  KeyRound,
  Landmark,
  Lock,
  type LucideIcon,
  PartyPopper,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Snowflake,
  Sun,
  TriangleAlert,
  UserCheck,
  UserX,
} from 'lucide-react'

import i18n, { type MessageKey } from '@/i18n'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

/**
 * The translation of an API code, or the code itself when this release doesn't know it.
 *
 * @param group the key its translations are under, such as `labels.roles`
 */
export function labelOf(group: string, code: string): string {
  return i18n.t(`${group}.${code}` as MessageKey, { defaultValue: code })
}

export function movementLabel(type: string | undefined, direction: string | undefined): string {
  if (type === 'TRANSFER') {
    return i18n.t(direction === 'IN' ? 'labels.movements.TRANSFER_IN' : 'labels.movements.TRANSFER_OUT')
  }
  return type ? labelOf('labels.movements', type) : i18n.t('labels.movement')
}

export function movementIcon(type: string | undefined, direction: string | undefined): LucideIcon {
  if (type === 'WITHDRAWAL') return Landmark
  if (type === 'WITHDRAWAL_REVERSAL') return RotateCcw
  if (type === 'DEPOSIT') return Banknote
  return direction === 'IN' ? ArrowDownLeft : ArrowUpRight
}

/** How a status shows: the key of its name and its color. */
export interface StatusStyle {
  labelKey: MessageKey
  tone: Tone
}

export const walletStatus: Record<string, StatusStyle> = {
  ACTIVE: { labelKey: 'labels.walletStatus.ACTIVE', tone: 'success' },
  FROZEN: { labelKey: 'labels.walletStatus.FROZEN', tone: 'info' },
}

export const userStatus: Record<string, StatusStyle> = {
  ACTIVE: { labelKey: 'labels.userStatus.ACTIVE', tone: 'success' },
  DISABLED: { labelKey: 'labels.userStatus.DISABLED', tone: 'danger' },
}

export const operationStatus: Record<string, StatusStyle> = {
  PENDING: { labelKey: 'labels.operationStatus.PENDING', tone: 'warning' },
  COMPLETED: { labelKey: 'labels.operationStatus.COMPLETED', tone: 'success' },
  PAID: { labelKey: 'labels.operationStatus.PAID', tone: 'success' },
  POSTED: { labelKey: 'labels.operationStatus.POSTED', tone: 'success' },
  UNMATCHED: { labelKey: 'labels.operationStatus.UNMATCHED', tone: 'danger' },
  EXPIRED: { labelKey: 'labels.operationStatus.EXPIRED', tone: 'neutral' },
  FAILED: { labelKey: 'labels.operationStatus.FAILED', tone: 'danger' },
  REJECTED: { labelKey: 'labels.operationStatus.REJECTED', tone: 'danger' },
  CONSISTENT: { labelKey: 'labels.operationStatus.CONSISTENT', tone: 'success' },
  DISCREPANCIES_FOUND: { labelKey: 'labels.operationStatus.DISCREPANCIES_FOUND', tone: 'danger' },
}

export const notificationVisuals: Record<string, { icon: LucideIcon; tone: Tone }> = {
  WELCOME: { icon: PartyPopper, tone: 'info' },
  ACCOUNT_LOCKED: { icon: Lock, tone: 'danger' },
  DEPOSIT_RECEIVED: { icon: Banknote, tone: 'success' },
  DEPOSIT_REJECTED: { icon: TriangleAlert, tone: 'danger' },
  WITHDRAWAL_SENT: { icon: Landmark, tone: 'info' },
  WITHDRAWAL_FAILED: { icon: TriangleAlert, tone: 'danger' },
  TRANSFER_SENT: { icon: ArrowUpRight, tone: 'neutral' },
  TRANSFER_RECEIVED: { icon: ArrowDownLeft, tone: 'success' },
  WALLET_FROZEN: { icon: Snowflake, tone: 'info' },
  WALLET_UNFROZEN: { icon: Sun, tone: 'success' },
  PASSWORD_CHANGED: { icon: KeyRound, tone: 'warning' },
  ACCOUNT_DISABLED: { icon: UserX, tone: 'danger' },
  ACCOUNT_ENABLED: { icon: UserCheck, tone: 'success' },
  BANK_ACCOUNT_ADDED: { icon: Building2, tone: 'warning' },
  TWO_FACTOR_ENABLED: { icon: ShieldCheck, tone: 'success' },
  TWO_FACTOR_DISABLED: { icon: ShieldOff, tone: 'warning' },
}

export const defaultNotificationVisual = { icon: BadgeCheck, tone: 'neutral' as Tone }

export const toneClasses: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning-foreground dark:text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-accent text-accent-foreground',
}

// Banks by the first three CLABE digits (Banxico codes); unknown ones show the code itself.
const banks: Record<string, string> = {
  '002': 'Banamex', '006': 'Bancomext', '009': 'Banobras', '012': 'BBVA', '014': 'Santander', '019': 'Banjército',
  '021': 'HSBC', '030': 'Bajío', '036': 'Inbursa', '042': 'Mifel', '044': 'Scotiabank', '058': 'Banregio',
  '059': 'Invex', '060': 'Bansi', '062': 'Afirme', '072': 'Banorte', '106': 'Bank of America', '113': 'Ve por Más',
  '127': 'Azteca', '130': 'Compartamos', '137': 'BanCoppel', '138': 'Uala', '166': 'Banco del Bienestar',
  '638': 'Nu México', '646': 'STP', '722': 'Mercado Pago W',
}

export function bankName(code: string | undefined): string {
  return (code && banks[code]) ?? i18n.t('labels.unknownBank', { code: code ?? '' }).trim()
}
