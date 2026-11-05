import i18n, { type ParseKeys } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { en } from './locales/en'
import { es } from './locales/es'

export const languages = ['es', 'en'] as const
export type Language = (typeof languages)[number]

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof es }
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    supportedLngs: languages,
    // es-MX, en-US... -> es, en
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    // Spanish until the user picks a language, whatever the browser's
    fallbackLng: 'es',
    // React already escapes rendered text
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'wallet.language',
      caches: ['localStorage'],
    },
  })

// Screen readers and browser translation read the page's language from here. Tests that run in Node have no document.
function syncDocument() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'es'
  }
}
i18n.on('languageChanged', syncDocument)
syncDocument()

/** Any translation key, for keys kept in data (menus, status maps) instead of written inline. */
export type MessageKey = ParseKeys

/** The language the screens are showing. */
export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'en' ? 'en' : 'es'
}

export default i18n
