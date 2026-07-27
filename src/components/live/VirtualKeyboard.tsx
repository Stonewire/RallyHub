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

const STATE_COLOR: Record<WordleCellState, string> = {
  correct: '#16A34A',
  present: '#D97706',
  // Darker than an untouched key, so a ruled-out letter reads as struck off
  // rather than as the next one to press.
  absent: '#252A33',
}

const UNUSED_KEY_COLOR = 'rgba(255,255,255,0.26)'

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
    // Sticky so a tall grid can never push Delete/Submit off the bottom of the
    // phone. pb-10 clears the fixed "Powered by RallyHub" badge underneath it.
    // -mx-3 cancels the participant page's gutter so the panel runs edge to edge.
    <div className="sticky bottom-0 z-30 -mx-3 bg-black/55 pt-2.5 pb-10 backdrop-blur-sm select-none">
      <div className="mx-auto w-full max-w-md space-y-1.5 px-3">
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
                  }}
                  // Ruled-out keys keep their solid grey instead of fading, so they
                  // still read as "already tried" rather than as a rendering glitch.
                  className={`flex h-12 items-center justify-center rounded-md text-base font-bold uppercase text-white transition-colors active:scale-95 ${
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
            style={{ width: `calc(${KEY_WIDTH} * 3 + 0.5rem)` }}
            className="flex h-12 items-center justify-center gap-1.5 rounded-md bg-white/25 text-xs font-bold uppercase text-white active:scale-95 disabled:opacity-40"
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
                backgroundColor: submitInactive ? UNUSED_KEY_COLOR : accentColor,
                color: submitInactive || !accentColor ? '#FFFFFF' : textOnAccent(accentColor),
              }}
              className="flex h-12 items-center justify-center rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-40"
            >
              {submitLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
