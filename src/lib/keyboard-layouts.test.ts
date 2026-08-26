import { describe, expect, it } from 'vitest'

import {
  KEY_VARIANTS,
  LETTER_ROWS,
  NUMBER_ROWS,
  SYMBOL_ROWS,
  keyVariantsForLanguage,
  keyboardColumns,
  letterRowsFor,
} from './keyboard-layouts'

const BULGARIAN_ALPHABET = [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ']
const ENGLISH_ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

describe('keyboard layouts', () => {
  it('cyrillic layout is the Bulgarian Phonetic QWERTY mapping', () => {
    expect(letterRowsFor('cyrillic')).toEqual([
      ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ш', 'Щ'],
      ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л'],
      ['З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч', 'Ю'],
    ])
  })

  it('cyrillic layout carries all 30 Bulgarian letters exactly once', () => {
    const keys = letterRowsFor('cyrillic').flat()
    expect(keys).toHaveLength(30)
    expect(new Set(keys).size).toBe(30)
    for (const letter of BULGARIAN_ALPHABET) {
      expect(keys.filter((key) => key === letter)).toHaveLength(1)
    }
  })

  it('latin layout carries all 26 English letters exactly once', () => {
    const keys = letterRowsFor('latin').flat()
    expect(keys).toHaveLength(26)
    expect(new Set(keys).size).toBe(26)
    for (const letter of ENGLISH_ALPHABET) {
      expect(keys.filter((key) => key === letter)).toHaveLength(1)
    }
  })

  it('column count follows the widest row of each alphabet', () => {
    expect(keyboardColumns('latin')).toBe(10)
    expect(keyboardColumns('cyrillic')).toBe(12)
  })

  it('number and symbol layers never exceed the narrowest board', () => {
    for (const row of [...NUMBER_ROWS, ...SYMBOL_ROWS]) {
      expect(row.length).toBeLessThanOrEqual(10)
    }
  })

  it('every variant hangs off a key that exists on the latin board', () => {
    const latinKeys = new Set(LETTER_ROWS.latin.flat())
    for (const [language, map] of Object.entries(KEY_VARIANTS)) {
      for (const [base, variants] of Object.entries(map)) {
        expect(latinKeys.has(base), `${language} variant base ${base}`).toBe(true)
        expect(variants.length).toBeGreaterThan(0)
        for (const variant of variants) {
          // Single letters only: the bubble commits them through the same
          // onKey path as a plain key press.
          expect([...variant]).toHaveLength(1)
          expect(/^\p{L}$/u.test(variant), `${language} ${base} -> ${variant}`).toBe(true)
          expect(variant.toLocaleUpperCase()).toBe(variant)
        }
        // No duplicate variants under one base key.
        expect(new Set(variants).size).toBe(variants.length)
      }
    }
  })

  it('wires the agreed per-language variant maps', () => {
    expect(keyVariantsForLanguage('es')).toMatchObject({
      A: ['Á'],
      E: ['É'],
      I: ['Í'],
      O: ['Ó'],
      U: ['Ú', 'Ü'],
      N: ['Ñ'],
    })
    expect(keyVariantsForLanguage('fr')).toMatchObject({
      A: ['À', 'Â'],
      E: ['É', 'È', 'Ê', 'Ë'],
      I: ['Î', 'Ï'],
      O: ['Ô', 'Œ'],
      U: ['Ù', 'Û', 'Ü'],
      C: ['Ç'],
      Y: ['Ÿ'],
    })
    expect(keyVariantsForLanguage('nl')).toMatchObject({
      A: ['Á'],
      E: ['É', 'Ë'],
      I: ['Ï'],
      O: ['Ó', 'Ö'],
      U: ['Ü'],
    })
  })

  it('English and Bulgarian have no variants, unknown languages fall back to none', () => {
    expect(keyVariantsForLanguage('en')).toEqual({})
    expect(keyVariantsForLanguage('bg')).toEqual({})
    expect(keyVariantsForLanguage(undefined)).toEqual({})
    expect(keyVariantsForLanguage('de')).toEqual({})
  })

  it('resolves region-tagged languages to their base variant map', () => {
    expect(keyVariantsForLanguage('fr-FR')).toEqual(keyVariantsForLanguage('fr'))
    expect(keyVariantsForLanguage('ES')).toEqual(keyVariantsForLanguage('es'))
  })
})
