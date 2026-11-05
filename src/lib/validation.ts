import i18n, { type MessageKey } from '@/i18n'

/** A zod message written when it validates, in the language active then: schemas are built once, as their file loads. */
export function message(key: MessageKey, values: Record<string, string | number> = {}) {
  return { error: () => i18n.t(key, values) as string }
}
