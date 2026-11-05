import {
  Bell,
  CircleUserRound,
  Building2,
  CreditCard,
  FileSearch,
  House,
  Landmark,
  type LucideIcon,
  ScrollText,
  Scale,
  Settings,
  Users,
  Wallet,
} from 'lucide-react'

import type { MessageKey } from '@/i18n'

export interface NavItem {
  to: string
  labelKey: MessageKey
  icon: LucideIcon
  /** Only this exact path lights it up (the home link would match everything otherwise). */
  end?: boolean
  badge?: 'unread'
}

export const mainNav: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House, end: true },
  { to: '/wallets', labelKey: 'nav.wallets', icon: Wallet },
  { to: '/bank-accounts', labelKey: 'nav.bankAccounts', icon: Building2 },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell, badge: 'unread' },
  { to: '/settings', labelKey: 'nav.account', icon: Settings },
]

export const adminNav: NavItem[] = [
  { to: '/admin/users', labelKey: 'nav.users', icon: Users },
  { to: '/admin/operations', labelKey: 'nav.operations', icon: FileSearch },
  { to: '/admin/reconciliations', labelKey: 'nav.reconciliations', icon: Scale },
  { to: '/admin/ledger', labelKey: 'nav.ledger', icon: Landmark },
  { to: '/admin/payments', labelKey: 'nav.payments', icon: CreditCard },
  { to: '/admin/audit', labelKey: 'nav.audit', icon: ScrollText },
]

/** The phone's bottom bar: the four places used most, around the send button. */
export const mobileNav: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House, end: true },
  { to: '/wallets', labelKey: 'nav.wallets', icon: Wallet },
  { to: '/notifications', labelKey: 'nav.notices', icon: Bell, badge: 'unread' },
  { to: '/settings', labelKey: 'nav.accountShort', icon: CircleUserRound },
]
