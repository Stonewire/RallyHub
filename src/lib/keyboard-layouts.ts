import type { AppLanguage } from '@/lib/i18n'

/**
 * On-screen keyboard layout data for the live player surfaces.
 *
 * One shared system: the VirtualKeyboard component carries the interaction
 * logic once, and every language plugs in here as data, so current and future
 * languages all follow the same QWERTY-style pattern and sizing. Rows are
 * stored uppercase; the component lowercases at commit time when shift is off.
 */

export type KeyboardAlphabet = 'latin' | 'cyrillic'

const LATIN_LETTER_ROWS: readonly (readonly string[])[] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

/**
 * Standard Bulgarian Phonetic: Cyrillic mapped onto QWERTY positions, the
 * layout Bulgarians actually type on. Ю lives on the backslash key on a PC
 * keyboard; appending it to row 3 keeps all 30 letters present on screen.
 */
const BULGARIAN_PHONETIC_ROWS: readonly (readonly string[])[] = [
  ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ш', 'Щ'],
  ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л'],
  ['З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч', 'Ю'],
]

export const LETTER_ROWS: Record<KeyboardAlphabet, readonly (readonly string[])[]> = {
  latin: LATIN_LETTER_ROWS,
  cyrillic: BULGARIAN_PHONETIC_ROWS,
}

/** Digits and everyday punctuation, in the phone-keyboard arrangement. */
export const NUMBER_ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '€', '&', '@', '"'],
  ['.', ',', '?', '!', "'"],
]

/** The second symbol layer, reached from the characters key. */
export const SYMBOL_ROWS: readonly (readonly string[])[] = [
  ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
  ['_', '\\', '|', '~', '<', '>', '$', '£', '¥', '•'],
  ['.', ',', '?', '!', "'"],
]

/**
 * Long-press variants per language, keyed by the base letter as it appears in
 * the rows above. Held keys pop these in a bubble, iPhone style. English and
 * Bulgarian have none by design.
 */
export const KEY_VARIANTS: Partial<Record<AppLanguage, Record<string, readonly string[]>>> = {
  es: {
    A: ['Á'],
    E: ['É'],
    I: ['Í'],
    O: ['Ó'],
    U: ['Ú', 'Ü'],
    N: ['Ñ'],
  },
  fr: {
    A: ['À', 'Â'],
    E: ['É', 'È', 'Ê', 'Ë'],
    I: ['Î', 'Ï'],
    O: ['Ô', 'Œ'],
    U: ['Ù', 'Û', 'Ü'],
    C: ['Ç'],
    Y: ['Ÿ'],
  },
  nl: {
    A: ['Á'],
    E: ['É', 'Ë'],
    I: ['Ï'],
    O: ['Ó', 'Ö'],
    U: ['Ü'],
  },
}

export function letterRowsFor(alphabet: KeyboardAlphabet): readonly (readonly string[])[] {
  return LETTER_ROWS[alphabet]
}

/**
 * Every key on the board shares one width derived from the widest letter row,
 * so shorter rows centre with an inset instead of stretching, and the number
 * and symbol layers line up with the letters. Never below 10: the digit rows
 * are 10 wide.
 */
export function keyboardColumns(alphabet: KeyboardAlphabet): number {
  return Math.max(10, ...LETTER_ROWS[alphabet].map((row) => row.length))
}

/** Variant map for the active UI language; tolerant of region tags like fr-FR. */
export function keyVariantsForLanguage(
  language: string | undefined,
): Record<string, readonly string[]> {
  const primary = (language ?? '').toLowerCase().split('-')[0] as AppLanguage
  return KEY_VARIANTS[primary] ?? {}
}
