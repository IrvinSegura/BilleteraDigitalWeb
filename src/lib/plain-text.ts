import i18n from '@/i18n'

// Same rule as the API's PlainText: names and concepts that other people read carry no markup or control characters
const MARKUP = /[<>\p{Cc}]/u

export function markupMessage(): string {
  return i18n.t('validation.markup')
}

export function hasMarkup(text: string): boolean {
  return MARKUP.test(text)
}
