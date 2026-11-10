import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useMutation } from '@tanstack/react-query'
import { MailWarning, Menu, PanelLeftClose, PanelLeftOpen, Plus, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { useMyOpenTicketCount, useOpenTicketCount, usePendingAdjustmentCount, usePendingIdentityCount, useUnreadCount } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { isStaff } from '@/auth/roles'
import { IdleGuard } from '@/auth/IdleGuard'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { MoneyActionsProvider, useMoneyActions } from '@/features/money/MoneyActions'
import { useLiveNotifications } from '@/features/notifications/live'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { cn } from '@/lib/utils'

import { adminNav, type BadgeCounts, mainNav, mobileNav, type NavItem, staffMobileNav, staffNav, supportNav } from './nav'
import { OfflineBanner } from './OfflineBanner'
import { UserMenu } from './UserMenu'

function NavEntry({ item, counts, onNavigate }: { item: NavItem; counts: BadgeCounts; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const count = item.badge ? counts[item.badge] ?? 0 : 0
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => cn(
        'group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <item.icon className="size-[1.05rem] shrink-0" />
      <span className="flex-1 truncate">{t(item.labelKey)}</span>
      {count > 0 && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.7rem] leading-none font-semibold text-primary-foreground tabular">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const unread = useUnreadCount().data?.count ?? 0
  const admin = user.role === 'ADMIN'
  const openTickets = useOpenTicketCount(admin).data?.open ?? 0
  const pendingIdentity = usePendingIdentityCount(admin).data?.pending ?? 0
  const pendingAdjustments = usePendingAdjustmentCount(admin).data?.pending ?? 0
  const myOpenTickets = useMyOpenTicketCount(user.role === 'SUPPORT').data?.open ?? 0
  const counts: BadgeCounts = { unread, openTickets, pendingIdentity, pendingAdjustments, myOpenTickets }
  const { open } = useMoneyActions()
  const staff = isStaff(user.role)
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1">
        <Logo />
      </div>
      {!staff && (
        <Button size="lg" className="w-full shadow-sm shadow-primary/25" onClick={() => { onNavigate?.(); open('transfer') }}>
          <Send /> {t('nav.sendMoney')}
        </Button>
      )}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto" aria-label={t('nav.main')}>
        {!staff && (
          <div className="grid gap-0.5">
            {mainNav.map((item) => <NavEntry key={item.to} item={item} counts={counts} onNavigate={onNavigate} />)}
          </div>
        )}
        {/* Like the administrators': their console first, and their notices and account below it */}
        {user.role === 'SUPPORT' && (
          <div className="grid gap-0.5">
            <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{t('nav.supportTeam')}</p>
            {[...supportNav, ...staffNav].map((item) => <NavEntry key={item.to} item={item} counts={counts} onNavigate={onNavigate} />)}
          </div>
        )}
        {user.role === 'ADMIN' && (
          <div className="grid gap-0.5">
            <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{t('nav.administration')}</p>
            {[...adminNav, ...staffNav].map((item) => <NavEntry key={item.to} item={item} counts={counts} onNavigate={onNavigate} />)}
          </div>
        )}
      </nav>
      <UserMenu variant="sidebar" />
    </div>
  )
}

function MobileDrawer() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.openMenu')} />}>
        <Menu />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r bg-sidebar shadow-xl duration-200 outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left">
          <DialogPrimitive.Title className="sr-only">{t('nav.menu')}</DialogPrimitive.Title>
          <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" className="absolute top-4 right-3" aria-label={t('nav.closeMenu')} />}>
            <X />
          </DialogPrimitive.Close>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function MobileTabBar() {
  const { t } = useTranslation()
  const user = useUser()
  const unread = useUnreadCount().data?.count ?? 0
  const myOpenTickets = useMyOpenTicketCount(user.role === 'SUPPORT').data?.open ?? 0
  const dotted: Partial<Record<NonNullable<NavItem['badge']>, boolean>> = { unread: unread > 0, myOpenTickets: myOpenTickets > 0 }
  const { open } = useMoneyActions()
  const [first, second, ...rest] = mobileNav
  const tab = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn('relative flex flex-1 flex-col items-center gap-1 py-2 text-[0.7rem] font-medium',
        isActive ? 'text-primary' : 'text-muted-foreground')}
    >
      <span className="relative">
        <item.icon className="size-5" />
        {item.badge && dotted[item.badge] && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-destructive ring-2 ring-background" />}
      </span>
      {t(item.labelKey)}
    </NavLink>
  )
  const barClass = 'fixed inset-x-0 bottom-0 z-40 flex items-end border-t bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden'
  if (isStaff(user.role)) {
    return <nav aria-label={t('nav.quickAccess')} className={barClass}>{staffMobileNav(user.role).map(tab)}</nav>
  }
  return (
    <nav aria-label={t('nav.quickAccess')} className={barClass}>
      {tab(first!)}
      {tab(second!)}
      <div className="flex flex-1 justify-center">
        <button type="button" onClick={() => open('transfer')} aria-label={t('nav.sendMoney')}
          className="-mt-5 mb-1.5 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95">
          <Plus className="size-6" />
        </button>
      </div>
      {rest.map(tab)}
    </nav>
  )
}

function VerifyEmailBanner() {
  const { t } = useTranslation()
  const user = useUser()
  const resend = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/users/me/email-verification')),
    onSuccess: () => toast.success(t('common.linkResentTo', { email: user.email })),
    onError: (error) => toast.error(errorMessage(error)),
  })
  if (user.emailVerified) {
    return null
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center">
      <MailWarning className="hidden size-5 shrink-0 text-warning-foreground sm:block dark:text-warning" />
      <p className="flex-1 text-sm">
        <span className="font-medium">{t('layout.verifyEmailTitle')}</span>{' '}
        <span className="text-muted-foreground">{t('layout.verifyEmailHint', { email: user.email })}</span>
      </p>
      <Button variant="outline" size="sm" className="bg-background" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
        {t(resend.isSuccess ? 'common.linkSent' : 'common.resendLink')}
      </Button>
    </div>
  )
}

// Remembered per browser: whoever hides the menu wants it hidden the next time too
const SIDEBAR_KEY = 'layout.sidebar.hidden'

function readSidebarHidden(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

/** Whether the desktop menu is hidden, to give the page all the width; phones use the drawer and the tab bar instead. */
function useSidebarHidden() {
  const [hidden, setHidden] = useState(readSidebarHidden)
  function toggle() {
    setHidden((h) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, h ? '0' : '1')
      } catch {
        // Only a convenience: it just won't be remembered
      }
      return !h
    })
  }
  return [hidden, toggle] as const
}

export function AppLayout() {
  const { t } = useTranslation()
  const [sidebarHidden, toggleSidebar] = useSidebarHidden()
  const { pathname } = useLocation()
  useLiveNotifications()
  // A new page starts at the top, like a full navigation would
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <MoneyActionsProvider>
      <div className={cn('min-h-svh transition-[grid-template-columns] duration-200 lg:grid',
        sidebarHidden ? 'lg:grid-cols-[0rem_1fr]' : 'lg:grid-cols-[17rem_1fr]')}>
        {/* The menu keeps its width and is clipped while it slides away; once hidden, nothing in it takes focus */}
        <aside id="app-sidebar" inert={sidebarHidden} className={cn('sticky top-0 hidden h-svh overflow-hidden bg-sidebar lg:block', !sidebarHidden && 'border-r')}>
          <div className="h-full w-68">
            <SidebarContent />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
            <MobileDrawer />
            <Button variant="ghost" size="icon" className="hidden lg:-ml-2 lg:inline-flex" onClick={toggleSidebar}
              aria-controls="app-sidebar" aria-expanded={!sidebarHidden}
              aria-label={t(sidebarHidden ? 'layout.showSidebar' : 'layout.hideSidebar')} title={t(sidebarHidden ? 'layout.showSidebar' : 'layout.hideSidebar')}>
              {sidebarHidden ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            {/* Without the menu, the brand and the account move up here, as on a phone */}
            <Logo className={cn(!sidebarHidden && 'lg:hidden')} />
            <div className="flex-1" />
            <ThemeToggle />
            <NotificationBell />
            <div className={cn(!sidebarHidden && 'lg:hidden')}>
              <UserMenu variant="compact" />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
            <OfflineBanner />
            <VerifyEmailBanner />
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </main>
        </div>
      </div>
      <MobileTabBar />
      <IdleGuard />
    </MoneyActionsProvider>
  )
}
