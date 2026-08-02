import { ArrowBigUp, CornerDownLeft, Delete } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'

import { textOnAccent } from '@/lib/live-event'
import type { WordleCellState } from '@/lib/puzzle-engine'

type Alphabet = 'latin' | 'cyrillic'

const LATIN_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

// Bulgarian 30-letter Cyrillic alphabet, alphabetical rows. This is a tap
// keyboard, not a physical one, so there is no ЙЦУКЕН layout to match.
const CYRILLIC_ROWS = [
  ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й'],
  ['К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У'],
  ['Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ь', 'Ю', 'Я'],
]

/** Digits and everyday punctuation, in the phone-keyboard arrangement. */
const NUMBER_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '€', '&', '@', '"'],
  ['.', ',', '?', '!', "'"],
]

/** The second symbol layer, reached from the characters key. */
const SYMBOL_ROWS = [
  ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
  ['_', '\\', '|', '~', '<', '>', '$', '£', '¥', '•'],
  ['.', ',', '?', '!', "'"],
]

/** Matches the guess tiles: green for placed, RallyHub yellow for present. */
const STATE_COLOR: Record<WordleCellState, string> = {
  correct: '#16A34A',
  present: '#FFC107',
  // Darker than an untouched key, so a ruled-out letter reads as struck off
  // rather than as the next one to press.
  absent: '#4B5563',
}

const STATE_TEXT: Record<WordleCellState, string> = {
  correct: '#FFFFFF',
  present: '#1C1917',
  absent: '#FFFFFF',
}

/** Untouched keys are white: a struck-off grey then reads as clearly spent. */
const UNUSED_KEY_COLOR = '#FFFFFF'
const UNUSED_KEY_TEXT = '#1C1917'
/** Modifier keys (shift, delete, layer switches) sit back from the letters. */
const MODIFIER_KEY_COLOR = '#4B5563'

/**
 * Every key is the same width regardless of how many sit in its row, so short
 * rows centre with the indent of a real QWERTY board instead of stretching to
 * fill. 10 keys per row plus the 9 gaps between them.
 */
const KEY_WIDTH = 'calc((100% - 9 * 0.25rem) / 10)'

/** Width of a key spanning `units` letter keys, gaps included. */
function spanWidth(units: number) {
  return `calc(${KEY_WIDTH} * ${units} + ${(units - 1) * 0.25}rem)`
}

type Layer = 'letters' | 'numbers' | 'symbols'

type Props = {
  alphabet: Alphabet
  onKey: (letter: string) => void
  onBackspace: () => void
  onSubmit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
  accentColor?: string
  keyState?: Record<string, WordleCellState>
  disabled?: boolean
  /**
   * Typing an answer needs more than letters, so this lays the board out like
   * a phone keyboard: shift and delete on the letter row, then number and
   * character layers, a space bar and the send key. Off for the puzzles, whose
   * answers are letters only.
   */
  fullText?: boolean
}

export function VirtualKeyboard({
  alphabet,
  onKey,
  onBackspace,
  onSubmit,
  submitDisabled,
  submitLabel = 'Submit',
  accentColor,
  keyState,
  disabled,
  fullText = false,
}: Props) {
  // Answers are compared exactly, so case is the player's to choose. Starts on
  // for the first letter, then releases itself, like a phone keyboard.
  const [shift, setShift] = useState(true)
  const [layer, setLayer] = useState<Layer>('letters')

  const letterRows = alphabet === 'cyrillic' ? CYRILLIC_ROWS : LATIN_ROWS
  const rows =
    !fullText || layer === 'letters'
      ? letterRows
      : layer === 'numbers'
        ? NUMBER_ROWS
        : SYMBOL_ROWS
  const keyStyle: CSSProperties = { width: KEY_WIDTH }
  const submitInactive = disabled || submitDisabled
  const showModifiers = fullText && layer === 'letters'

  function press(char: string) {
    if (!fullText) {
      onKey(char)
      return
    }
    onKey(layer === 'letters' && !shift ? char.toLocaleLowerCase() : char)
    if (shift) setShift(false)
  }

  function modifierKey(
    label: ReactNode,
    onClick: () => void,
    units: number,
    ariaLabel: string,
    active = false,
  ) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={active}
        style={{
          width: spanWidth(units),
          backgroundColor: active ? UNUSED_KEY_COLOR : MODIFIER_KEY_COLOR,
          color: active ? UNUSED_KEY_TEXT : '#FFFFFF',
        }}
        className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-40"
      >
        {label}
      </button>
    )
  }

  return (
    // Fixed and edge to edge: a tall grid can never push Delete/Submit off the
    // screen, and the keys get the full width to sit in. It stops above the
    // chat, exit and RallyHub badge rather than laying its panel over them.
    <div className="fixed inset-x-0 bottom-[4.5rem] z-[9997] bg-black/55 py-2.5 backdrop-blur-sm select-none">
      {/* The panel runs to the edges, the keys keep a margin from them. */}
      <div className="mx-auto w-full max-w-2xl space-y-1.5 px-5">
        {rows.map((row, i) => {
          const lastRow = i === rows.length - 1
          return (
            <div key={i} className="flex justify-center gap-1">
              {/* Shift and delete bracket the last row, as on a phone. */}
              {showModifiers && lastRow
                ? modifierKey(
                    <ArrowBigUp className={`size-5 ${shift ? 'fill-current' : ''}`} />,
                    () => setShift((on) => !on),
                    1.5,
                    'Shift',
                    shift,
                  )
                : null}
              {row.map((letter) => {
                const state = keyState?.[letter.toLocaleLowerCase()]
                // A letter is only ever 'absent' once every occurrence of it has come
                // back absent, so locking it can never hide a letter still in play.
                const locked = state === 'absent'
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={disabled || locked}
                    onClick={() => press(letter)}
                    style={{
                      ...keyStyle,
                      backgroundColor: state ? STATE_COLOR[state] : UNUSED_KEY_COLOR,
                      color: state ? STATE_TEXT[state] : UNUSED_KEY_TEXT,
                    }}
                    // Ruled-out keys keep their solid grey instead of fading, so they
                    // still read as "already tried" rather than as a rendering glitch.
                    className={`flex aspect-square items-center justify-center rounded-md text-base font-bold transition-colors active:scale-95 md:aspect-auto md:h-12 ${
                      fullText && layer === 'letters' && !shift ? 'lowercase' : 'uppercase'
                    } ${disabled && !locked ? 'opacity-40' : ''}`}
                  >
                    {letter}
                  </button>
                )
              })}
              {/* On a phone Delete sits at the end of the last letter row, so the
                  keyboard costs one row less of the screen. */}
              {!fullText && lastRow ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onBackspace}
                  aria-label="Delete last letter"
                  style={{ ...keyStyle, backgroundColor: STATE_COLOR.absent }}
                  className="flex aspect-square items-center justify-center rounded-md text-white active:scale-95 disabled:opacity-40 md:hidden"
                >
                  <Delete className="size-4" />
                </button>
              ) : null}
              {fullText && lastRow
                ? modifierKey(<Delete className="size-5" />, onBackspace, 1.5, 'Delete last letter')
                : null}
            </div>
          )
        })}

        {fullText ? (
          <div className="flex justify-center gap-1 pt-1">
            {modifierKey(
              layer === 'letters' ? '123' : 'ABC',
              () => setLayer(layer === 'letters' ? 'numbers' : 'letters'),
              1.5,
              layer === 'letters' ? 'Numbers' : 'Letters',
            )}
            {modifierKey(
              layer === 'symbols' ? '123' : '#+=',
              () => setLayer(layer === 'symbols' ? 'numbers' : 'symbols'),
              1.5,
              'Characters',
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onKey(' ')}
              aria-label="Space"
              style={{
                width: spanWidth(4.5),
                backgroundColor: UNUSED_KEY_COLOR,
                color: UNUSED_KEY_TEXT,
              }}
              className="flex h-12 shrink-0 items-center justify-center rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-40"
            >
              Space
            </button>
            {onSubmit ? (
              <button
                type="button"
                disabled={submitInactive}
                onClick={onSubmit}
                aria-label={submitLabel}
                style={{
                  width: spanWidth(2.5),
                  // Keeps the accent even while inactive — it is the key that
                  // sends the answer, and a grey one read as a dead control.
                  backgroundColor: accentColor ?? UNUSED_KEY_COLOR,
                  color: accentColor ? textOnAccent(accentColor) : '#FFFFFF',
                }}
                className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-50"
              >
                <CornerDownLeft className="size-4" />
                {submitLabel}
              </button>
            ) : null}
          </div>
        ) : (
          <div className={`justify-center gap-1 pt-1 ${onSubmit ? 'flex' : 'hidden md:flex'}`}>
            <button
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              aria-label="Delete last letter"
              style={{ width: spanWidth(3), backgroundColor: STATE_COLOR.absent }}
              className="hidden h-12 items-center justify-center gap-1.5 rounded-md text-xs font-bold text-white uppercase active:scale-95 disabled:opacity-40 md:flex"
            >
              <Delete className="size-4" /> Delete
            </button>
            {onSubmit ? (
              <button
                type="button"
                disabled={submitInactive}
                onClick={onSubmit}
                style={{
                  width: spanWidth(5),
                  backgroundColor: accentColor ?? UNUSED_KEY_COLOR,
                  color: accentColor ? textOnAccent(accentColor) : '#FFFFFF',
                }}
                className="flex h-12 items-center justify-center rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-50"
              >
                {submitLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
