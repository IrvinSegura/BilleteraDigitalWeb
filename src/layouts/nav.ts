import {
  Bell,
  ClipboardList,
  CircleUserRound,
  Building2,
  CreditCard,
  FileSearch,
  FileText,
  IdCard,
  HandCoins,
  Headset,
  House,
  Inbox,
  Landmark,
  LifeBuoy,
  type LucideIcon,
  ScrollText,
  Scale,
  Settings,
  ShieldCheck,
  Ticket,
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
  badge?: Badge
}

/** What a menu entry can count: the user's unread notices, or what waits for an administrator. */
export type Badge = 'unread' | 'openTickets' | 'pendingIdentity' | 'pendingAdjustments' | 'myOpenTickets'
export type BadgeCounts = Partial<Record<Badge, number>>

export const mainNav: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House, end: true },
  { to: '/wallets', labelKey: 'nav.wallets', icon: Wallet },
  { to: '/statements', labelKey: 'nav.statements', icon: FileText },
  { to: '/bank-accounts', labelKey: 'nav.bankAccounts', icon: Building2 },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell, badge: 'unread' },
  { to: '/settings', labelKey: 'nav.account', icon: Settings },
  // Exact, because the agents' inbox lives under it and has its own link
  { to: '/support', labelKey: 'nav.support', icon: LifeBuoy, end: true },
]

/** Staff run the app and hold no money: they only keep their notices and their account. */
export const staffNav: NavItem[] = [
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell, badge: 'unread' },
  { to: '/settings', labelKey: 'nav.account', icon: Settings },
]

export const supportNav: NavItem[] = [
  { to: '/support/inbox', labelKey: 'nav.inbox', icon: Inbox },
  // What the agent passed to the administrators and still waits
  { to: '/support/escalated', labelKey: 'nav.escalated', icon: ClipboardList, badge: 'myOpenTickets' },
]

export const adminNav: NavItem[] = [
  // Exact, because every other screen of the console lives under it
  { to: '/admin', labelKey: 'nav.home', icon: House, end: true },
  { to: '/admin/users', labelKey: 'nav.users', icon: Users },
  { to: '/admin/identity', labelKey: 'nav.identity', icon: IdCard, badge: 'pendingIdentity' },
  { to: '/admin/wallets', labelKey: 'nav.wallets', icon: Wallet },
  { to: '/admin/operations', labelKey: 'nav.operations', icon: FileSearch },
  { to: '/admin/reconciliations', labelKey: 'nav.reconciliations', icon: Scale },
  { to: '/admin/ledger', labelKey: 'nav.ledger', icon: Landmark },
  { to: '/admin/payments', labelKey: 'nav.payments', icon: CreditCard },
  { to: '/admin/support', labelKey: 'nav.support', icon: Headset },
  { to: '/admin/tickets', labelKey: 'nav.tickets', icon: Ticket, badge: 'openTickets' },
  { to: '/admin/adjustments', labelKey: 'nav.adjustments', icon: HandCoins, badge: 'pendingAdjustments' },
  { to: '/admin/audit', labelKey: 'nav.audit', icon: ScrollText },
]

/** Staff's bottom bar on a phone: their console, notices and account, with no send button. */
export const staffMobileNav = (role: string | undefined): NavItem[] => [
  ...(role === 'ADMIN'
    ? [{ to: '/admin', labelKey: 'nav.administration', icon: ShieldCheck } satisfies NavItem]
    : [
        { to: '/support/inbox', labelKey: 'nav.inbox', icon: Inbox } satisfies NavItem,
        { to: '/support/escalated', labelKey: 'nav.escalated', icon: ClipboardList, badge: 'myOpenTickets' } satisfies NavItem,
      ]),
  { to: '/notifications', labelKey: 'nav.notices', icon: Bell, badge: 'unread' },
  { to: '/settings', labelKey: 'nav.accountShort', icon: CircleUserRound },
]

/** The phone's bottom bar: the four places used most, around the send button. */
export const mobileNav: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: House, end: true },
  { to: '/wallets', labelKey: 'nav.wallets', icon: Wallet },
  { to: '/notifications', labelKey: 'nav.notices', icon: Bell, badge: 'unread' },
  { to: '/settings', labelKey: 'nav.accountShort', icon: CircleUserRound },
]
