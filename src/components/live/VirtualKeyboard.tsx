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
  absent: '#4B5563',
}

type Props = {
  alphabet: Alphabet
  onKey: (letter: string) => void
  onBackspace: () => void
  onSubmit?: () => void
  submitDisabled?: boolean
  keyState?: Record<string, WordleCellState>
  disabled?: boolean
}

export function VirtualKeyboard({
  alphabet,
  onKey,
  onBackspace,
  onSubmit,
  submitDisabled,
  keyState,
  disabled,
}: Props) {
  const rows = alphabet === 'cyrillic' ? CYRILLIC_ROWS : LATIN_ROWS
  return (
    <div className="space-y-1.5 select-none">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {row.map((letter) => {
            const state = keyState?.[letter.toLocaleLowerCase()]
            const locked = state === 'absent'
            return (
              <button
                key={letter}
                type="button"
                disabled={disabled || locked}
                onClick={() => onKey(letter)}
                className="flex h-10 min-w-8 flex-1 items-center justify-center rounded-md text-sm font-bold uppercase text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: state ? STATE_COLOR[state] : 'rgba(255,255,255,0.12)' }}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ))}
      <div className="flex justify-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          className="h-10 flex-[1.5] rounded-md bg-white/10 text-xs font-bold uppercase text-white disabled:opacity-40"
        >
          Delete
        </button>
        {onSubmit ? (
          <button
            type="button"
            disabled={disabled || submitDisabled}
            onClick={onSubmit}
            className="h-10 flex-[1.5] rounded-md bg-white/10 text-xs font-bold uppercase text-white disabled:opacity-40"
          >
            Submit
          </button>
        ) : null}
      </div>
    </div>
  )
}
