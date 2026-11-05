import { ArrowDownLeft, ArrowUpRight, Lock, ShieldCheck, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { PageErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/Logo'
import type { MessageKey } from '@/i18n'

import { PreferencesMenu } from './PreferencesMenu'

const highlights: { icon: typeof Zap; title: MessageKey; text: MessageKey }[] = [
  { icon: Zap, title: 'layout.hero.highlights.instantTitle', text: 'layout.hero.highlights.instantText' },
  { icon: ShieldCheck, title: 'layout.hero.highlights.twoFactorTitle', text: 'layout.hero.highlights.twoFactorText' },
  { icon: Lock, title: 'layout.hero.highlights.ledgerTitle', text: 'layout.hero.highlights.ledgerText' },
]

// A mock of the balance card, so the sign-in page shows what is waiting inside
function PreviewCard() {
  const { t } = useTranslation()
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute -inset-6 rounded-[2rem] bg-white/10 blur-2xl" />
      <div className="relative space-y-5 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between text-white/70">
          <span className="text-xs font-medium tracking-wide uppercase">{t('common.availableBalance')}</span>
          <span className="rounded-md bg-white/15 px-2 py-0.5 text-[0.7rem] font-semibold text-white">MXN</span>
        </div>
        <p className="text-4xl font-semibold tracking-tight text-white tabular">$24,850.00</p>
        <div className="space-y-2.5">
          {[
            { icon: ArrowDownLeft, label: t('labels.movements.TRANSFER_IN'), amount: '+$1,200.00', positive: true },
            { icon: ArrowUpRight, label: t('layout.hero.paymentToAna'), amount: '−$350.00', positive: false },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white">
                <row.icon className="size-4" />
              </span>
              <span className="flex-1 text-sm text-white/85">{row.label}</span>
              <span className={row.positive ? 'text-sm font-medium text-emerald-300 tabular' : 'text-sm font-medium text-white tabular'}>
                {row.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AuthLayout() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="brand-surface relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <Logo inverted className="relative" />
        <div className="relative flex flex-col items-start gap-10 py-8">
          <div className="max-w-md space-y-4">
            <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance text-white">
              {t('layout.hero.title')}
            </h2>
            <p className="text-lg text-white/75 text-pretty">
              {t('layout.hero.text')}
            </p>
          </div>
          <PreviewCard />
        </div>
        <ul className="relative grid gap-5 xl:grid-cols-3 [@media(max-height:820px)]:hidden">
          {highlights.map((item) => (
            <li key={item.title} className="space-y-1.5">
              <item.icon className="size-5 text-white/80" />
              <p className="text-sm font-medium text-white">{t(item.title)}</p>
              <p className="text-xs leading-relaxed text-white/65">{t(item.text)}</p>
            </li>
          ))}
        </ul>
      </aside>
      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <PreferencesMenu />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t('layout.footer', { year: new Date().getFullYear() })}
        </p>
      </main>
    </div>
  )
}

export function AuthHeading({ title, description, icon }: { title: string; description?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-8 space-y-2">
      {icon}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
    </div>
  )
}
