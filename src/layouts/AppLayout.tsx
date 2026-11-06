import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useMutation } from '@tanstack/react-query'
import { MailWarning, Menu, Plus, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { useUnreadCount } from '@/api/queries'
import { useUser } from '@/auth/auth-context'
import { IdleGuard } from '@/auth/IdleGuard'
import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { MoneyActionsProvider, useMoneyActions } from '@/features/money/MoneyActions'
import { useLiveNotifications } from '@/features/notifications/live'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { cn } from '@/lib/utils'

import { adminNav, mainNav, mobileNav, type NavItem, supportNav } from './nav'
import { OfflineBanner } from './OfflineBanner'
import { UserMenu } from './UserMenu'

function NavEntry({ item, unread, onNavigate }: { item: NavItem; unread: number; onNavigate?: () => void }) {
  const { t } = useTranslation()
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
      {item.badge === 'unread' && unread > 0 && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.7rem] leading-none font-semibold text-primary-foreground tabular">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const user = useUser()
  const unread = useUnreadCount().data?.count ?? 0
  const { open } = useMoneyActions()
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1">
        <Logo />
      </div>
      <Button size="lg" className="w-full shadow-sm shadow-primary/25" onClick={() => { onNavigate?.(); open('transfer') }}>
        <Send /> {t('nav.sendMoney')}
      </Button>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto" aria-label={t('nav.main')}>
        <div className="grid gap-0.5">
          {mainNav.map((item) => <NavEntry key={item.to} item={item} unread={unread} onNavigate={onNavigate} />)}
        </div>
        {user.role === 'SUPPORT' && (
          <div className="grid gap-0.5">
            <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{t('nav.supportTeam')}</p>
            {supportNav.map((item) => <NavEntry key={item.to} item={item} unread={unread} onNavigate={onNavigate} />)}
          </div>
        )}
        {user.role === 'ADMIN' && (
          <div className="grid gap-0.5">
            <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">{t('nav.administration')}</p>
            {adminNav.map((item) => <NavEntry key={item.to} item={item} unread={unread} onNavigate={onNavigate} />)}
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
  const unread = useUnreadCount().data?.count ?? 0
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
        {item.badge === 'unread' && unread > 0 && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-destructive ring-2 ring-background" />}
      </span>
      {t(item.labelKey)}
    </NavLink>
  )
  return (
    <nav aria-label={t('nav.quickAccess')}
      className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
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

export function AppLayout() {
  const { pathname } = useLocation()
  useLiveNotifications()
  // A new page starts at the top, like a full navigation would
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <MoneyActionsProvider>
      <div className="min-h-svh lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="sticky top-0 hidden h-svh border-r bg-sidebar lg:block">
          <SidebarContent />
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
            <MobileDrawer />
            <Logo className="lg:hidden" />
            <div className="flex-1" />
            <ThemeToggle />
            <NotificationBell />
            <div className="lg:hidden">
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
