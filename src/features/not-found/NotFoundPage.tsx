import { MapPinOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Logo } from '@/components/Logo'
import { buttonVariants } from '@/components/ui/button'

/**
 * An address the app doesn't have, from a mistyped or outdated link. Saying so beats quietly sending everyone home:
 * whoever followed it learns the link is wrong. Home signs in first when needed.
 */
export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 px-4">
      <Logo />
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <MapPinOff className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">{t('notFound.hint')}</p>
        <Link to="/" className={buttonVariants({ size: 'lg', className: 'mt-8 w-full' })}>{t('notFound.home')}</Link>
      </div>
    </main>
  )
}
