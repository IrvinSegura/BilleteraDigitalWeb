import { describe, expect, it } from 'vitest'

import { en } from './locales/en'
import { es } from './locales/es'

function flatten(messages: object, prefix = ''): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? { ...flat, [path]: value } : { ...flat, ...flatten(value as object, path) }
  }, {})
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map(([match]) => match).sort()
}

describe('translations', () => {
  const spanish = flatten(es)
  const english = flatten(en)

  it('has the same keys in both languages', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort())
  })

  it('has text for every key in both languages', () => {
    const empty = Object.entries({ ...spanish, ...english }).filter(([, text]) => !text.trim())
    expect(empty).toEqual([])
  })

  it('keeps the same placeholders and markup in both languages', () => {
    const different = Object.keys(spanish).filter(
      (key) => placeholders(spanish[key] ?? '').join() !== placeholders(english[key] ?? '').join(),
    )
    expect(different).toEqual([])
  })
})
