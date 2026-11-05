import { Languages, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { currentLanguage, type Language, languages } from '@/i18n'
import { cn } from '@/lib/utils'

/** The row that switches the language; the menu stays open so the change can be seen. */
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const language = currentLanguage()
  const next: Language = language === 'es' ? 'en' : 'es'

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={() => void i18n.changeLanguage(next)}
      aria-label={t('preferences.switchLanguage', { language: t(`preferences.languages.${next}`) })}
    >
      <Languages />
      {t('preferences.language')}
      <Segmented value={language} options={languages.map((option) => ({ value: option, label: option.toUpperCase() }))} />
    </DropdownMenuItem>
  )
}

/** The row that switches between the light and dark themes. */
export function ThemeToggleItem() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={t(dark ? 'preferences.useLightTheme' : 'preferences.useDarkTheme')}
    >
      {dark ? <Moon /> : <Sun />}
      {t('preferences.theme')}
      <Segmented
        value={dark ? 'dark' : 'light'}
        options={[
          { value: 'light', label: <Sun className="size-3.5" />, title: t('preferences.themes.light') },
          { value: 'dark', label: <Moon className="size-3.5" />, title: t('preferences.themes.dark') },
        ]}
      />
    </DropdownMenuItem>
  )
}

// Only shows the current option: the whole row is what switches it
function Segmented<T extends string>({ value, options }: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
}) {
  return (
    <span className="ml-auto flex rounded-full bg-muted p-0.5" aria-hidden>
      {options.map((option) => (
        <span
          key={option.value}
          title={option.title}
          className={cn(
            'flex h-5 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors',
            option.value === value && 'bg-background text-foreground shadow-sm',
          )}
        >
          {option.label}
        </span>
      ))}
    </span>
  )
}
