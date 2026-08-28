import { describe, expect, it } from 'vitest'

import {
  LATIN_KEY_VARIANTS,
  LETTER_ROWS,
  NUMBER_ROWS,
  SYMBOL_ROWS,
  keyVariantsFor,
  keyboardColumns,
  letterRowsFor,
} from './keyboard-layouts'

const BULGARIAN_ALPHABET = [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ']
const ENGLISH_ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

describe('keyboard layouts', () => {
  it('cyrillic layout matches the iOS Bulgarian keyboard exactly', () => {
    expect(letterRowsFor('cyrillic')).toEqual([
      ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ю'],
      ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л', 'Ш', 'Щ'],
      ['З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч'],
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
    expect(keyboardColumns('cyrillic')).toBe(11)
  })

  it('cyrillic row 3 plus shift and backspace fills the board exactly', () => {
    // Shift and backspace each span 1.5 letter keys, so eight letters between
    // them make 11 units: the same width as the 11-column rows above. The row
    // therefore sits centred and flush without any special casing.
    const rows = letterRowsFor('cyrillic')
    const lastRow = rows[rows.length - 1]!
    expect(lastRow.length + 1.5 + 1.5).toBe(keyboardColumns('cyrillic'))
  })

  it('number and symbol layers never exceed the narrowest board', () => {
    for (const row of [...NUMBER_ROWS, ...SYMBOL_ROWS]) {
      expect(row.length).toBeLessThanOrEqual(10)
    }
  })

  it('every variant hangs off a key that exists on the latin board', () => {
    const latinKeys = new Set(LETTER_ROWS.latin.flat())
    for (const [base, variants] of Object.entries(LATIN_KEY_VARIANTS)) {
      expect(latinKeys.has(base), `variant base ${base}`).toBe(true)
      expect(variants.length).toBeGreaterThan(0)
      for (const variant of variants) {
        // Single letters only: the bubble commits them through the same
        // onKey path as a plain key press.
        expect([...variant]).toHaveLength(1)
        expect(/^\p{L}$/u.test(variant), `${base} -> ${variant}`).toBe(true)
        expect(variant.toLocaleUpperCase()).toBe(variant)
      }
      // No duplicate variants under one base key.
      expect(new Set(variants).size).toBe(variants.length)
    }
  })

  it('carries the agreed union accent map', () => {
    expect(LATIN_KEY_VARIANTS).toEqual({
      A: ['Á', 'À', 'Â'],
      E: ['É', 'È', 'Ê', 'Ë'],
      I: ['Í', 'Î', 'Ï'],
      O: ['Ó', 'Ô', 'Ö', 'Œ'],
      U: ['Ú', 'Ù', 'Û', 'Ü'],
      N: ['Ñ'],
      C: ['Ç'],
      Y: ['Ÿ'],
    })
  })

  it('offers the full union on every latin board, whatever the UI language', () => {
    // An organiser can set an accented answer while a team's device is pinned
    // to English, so the accents must not depend on the language at all.
    expect(keyVariantsFor('latin')).toBe(LATIN_KEY_VARIANTS)
  })

  it('cyrillic keeps no variants', () => {
    expect(keyVariantsFor('cyrillic')).toEqual({})
  })
})
