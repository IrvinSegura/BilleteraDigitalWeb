/** The Intl locale for a screen language (dates and relative times); money always keeps es-MX. */
export function intlLocale(language: string): string {
  return language.startsWith('es') ? 'es-MX' : 'en-US'
}
