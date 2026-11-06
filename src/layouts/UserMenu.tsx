import { ChevronsUpDown, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuth, useUser } from '@/auth/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

import { LanguageToggle, ThemeToggleItem } from './PreferenceToggles'

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white', className)}>
      {initials(name)}
    </span>
  )
}

/** The account menu; "sidebar" is the full-width card at the bottom of the sidebar, "compact" just the avatar. */
export function UserMenu({ variant }: { variant: 'sidebar' | 'compact' }) {
  const user = useUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        // The sidebar card is named by the name and email it shows; the avatar alone needs a label
        aria-label={variant === 'compact' ? t('layout.accountMenu') : undefined}
        className={cn(
          'flex items-center gap-3 rounded-xl text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
          variant === 'sidebar' ? 'w-full p-2 hover:bg-sidebar-accent' : 'rounded-full',
        )}
      >
        <Avatar name={user.fullName} />
        {variant === 'sidebar' && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === 'sidebar' ? 'start' : 'end'} side={variant === 'sidebar' ? 'top' : 'bottom'} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <span className="block truncate text-sm font-medium text-foreground">{user.fullName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            {user.role !== 'USER' && (
              <span className="mt-1.5 inline-flex rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-medium text-accent-foreground">
                {t(`labels.roles.${user.role}`)}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/settings')}><Settings /> {t('nav.account')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings#security')}><ShieldCheck /> {t('layout.security')}</DropdownMenuItem>
        <LanguageToggle />
        <ThemeToggleItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}><LogOut /> {t('common.signOut')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
