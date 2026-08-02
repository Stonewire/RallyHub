import { Delete } from 'lucide-react'
import type { CSSProperties } from 'react'

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

/**
 * Every key is the same width regardless of how many sit in its row, so short
 * rows centre with the indent of a real QWERTY board instead of stretching to
 * fill. 10 keys per row plus the 9 gaps between them.
 */
const KEY_WIDTH = 'calc((100% - 9 * 0.25rem) / 10)'

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
}: Props) {
  const rows = alphabet === 'cyrillic' ? CYRILLIC_ROWS : LATIN_ROWS
  const keyStyle: CSSProperties = { width: KEY_WIDTH }
  const submitInactive = disabled || submitDisabled

  return (
    // Fixed and edge to edge: a tall grid can never push Delete/Submit off the
    // screen, and the keys get the full width to sit in. It stops above the
    // chat, exit and RallyHub badge rather than laying its panel over them.
    <div className="fixed inset-x-0 bottom-[4.5rem] z-[9997] bg-black/55 py-2.5 backdrop-blur-sm select-none">
      <div className="w-full space-y-1.5 px-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-1">
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
                  onClick={() => onKey(letter)}
                  style={{
                    ...keyStyle,
                    backgroundColor: state ? STATE_COLOR[state] : UNUSED_KEY_COLOR,
                    color: state ? STATE_TEXT[state] : UNUSED_KEY_TEXT,
                  }}
                  // Ruled-out keys keep their solid grey instead of fading, so they
                  // still read as "already tried" rather than as a rendering glitch.
                  className={`flex h-12 items-center justify-center rounded-md text-base font-bold uppercase transition-colors active:scale-95 ${
                    disabled && !locked ? 'opacity-40' : ''
                  }`}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        ))}
        <div className="flex justify-center gap-1 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onBackspace}
            aria-label="Delete last letter"
            style={{ width: `calc(${KEY_WIDTH} * 3 + 0.5rem)`, backgroundColor: STATE_COLOR.absent }}
            className="flex h-12 items-center justify-center gap-1.5 rounded-md text-xs font-bold text-white uppercase active:scale-95 disabled:opacity-40"
          >
            <Delete className="size-4" /> Delete
          </button>
          {onSubmit ? (
            <button
              type="button"
              disabled={submitInactive}
              onClick={onSubmit}
              style={{
                width: `calc(${KEY_WIDTH} * 4 + 0.75rem)`,
                // Keeps the accent even while inactive — it is the key that
                // sends the guess, and a grey one read as a dead control.
                backgroundColor: accentColor ?? UNUSED_KEY_COLOR,
                color: accentColor ? textOnAccent(accentColor) : '#FFFFFF',
              }}
              className="flex h-12 items-center justify-center rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-50"
            >
              {submitLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
