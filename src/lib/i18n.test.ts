import { describe, expect, it } from 'vitest'

const modules = import.meta.glob('../locales/*/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child !== null && typeof child === 'object'
      ? flattenKeys(child as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

function localeOf(path: string): { lang: string; namespace: string } {
  const match = path.match(/locales\/([a-z]{2})\/([a-z]+)\.json$/) as RegExpMatchArray
  return { lang: match[1], namespace: match[2] }
}

const LANGS = ['en', 'bg', 'es', 'fr', 'nl']
const NAMESPACES = ['common', 'live', 'facilitator', 'admin']

describe('locale parity', () => {
  it('ships every namespace for every language', () => {
    for (const lang of LANGS) {
      for (const ns of NAMESPACES) {
        const found = Object.keys(modules).some(
          (path) => localeOf(path).lang === lang && localeOf(path).namespace === ns,
        )
        expect(found, `${lang}/${ns}.json missing`).toBe(true)
      }
    }
  })

  it('keeps every language key-identical to English', () => {
    for (const ns of NAMESPACES) {
      const english = Object.entries(modules).find(
        (entry) => localeOf(entry[0]).lang === 'en' && localeOf(entry[0]).namespace === ns,
      )
      const englishKeys = flattenKeys((english as [string, { default: Record<string, unknown> }])[1].default).sort()
      for (const lang of LANGS.filter((code) => code !== 'en')) {
        const file = Object.entries(modules).find(
          (entry) => localeOf(entry[0]).lang === lang && localeOf(entry[0]).namespace === ns,
        )
        const keys = flattenKeys((file as [string, { default: Record<string, unknown> }])[1].default).sort()
        expect(keys, `${lang}/${ns}.json diverges from en`).toEqual(englishKeys)
      }
    }
  })

  it('never leaves a translation empty', () => {
    for (const [path, mod] of Object.entries(modules)) {
      const flat = flattenKeys(mod.default)
      for (const key of flat) {
        const value = key.split('.').reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)[part],
          mod.default,
        )
        expect(String(value).trim().length, `${path} ${key} is empty`).toBeGreaterThan(0)
      }
    }
  })
})

import { i18n } from '@/lib/i18n'

import { initI18n, setAppLanguage } from './i18n'

describe('setAppLanguage', () => {
  it('falls back to English for unknown codes', async () => {
    await initI18n()
    await setAppLanguage('de')
    expect(i18n.language).toBe('en')
  })

  it('activates a supported language', async () => {
    await setAppLanguage('bg')
    expect(i18n.language).toBe('bg')
  })
})
