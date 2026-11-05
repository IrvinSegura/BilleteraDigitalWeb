import { Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { LanguageToggle, ThemeToggleItem } from './PreferenceToggles'

/** Language and theme for whoever isn't signed in, who has no account menu to find them in. */
export function PreferencesMenu() {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('preferences.title')} />}>
        <Settings2 />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <LanguageToggle />
        <ThemeToggleItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
