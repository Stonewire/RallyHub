import { ArrowBigUp, CornerDownLeft, Delete } from 'lucide-react'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { textOnAccent } from '@/lib/live-event'
import { playKeyClickSound, type KeyClickKind } from '@/lib/sounds'
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
  // Answers are compared exactly, so case is the player's to choose. Starts on
  // for the first letter, then releases itself, like a phone keyboard.
  const [shift, setShift] = useState(true)
  const [layer, setLayer] = useState<Layer>('letters')
  // The key currently under a finger, for the iOS-style popped-up preview.
  const [poppedKey, setPoppedKey] = useState<string | null>(null)
  const popTimerRef = useRef<number | null>(null)

  /** Click + (Android) haptic on every key, like the phone's own keyboard. */
  function keyFeedback(kind: KeyClickKind = 'key') {
    playKeyClickSound(kind)
    navigator.vibrate?.(8)
  }

  /** Shows the popped letter briefly even on the fastest tap. */
  function popKey(letter: string) {
    if (popTimerRef.current != null) window.clearTimeout(popTimerRef.current)
    setPoppedKey(letter)
    popTimerRef.current = window.setTimeout(() => setPoppedKey(null), 220)
  }

  const letterRows = alphabet === 'cyrillic' ? CYRILLIC_ROWS : LATIN_ROWS
  const rows =
    layer === 'letters' ? letterRows : layer === 'numbers' ? NUMBER_ROWS : SYMBOL_ROWS
  const keyStyle: CSSProperties = { width: KEY_WIDTH }
  const submitInactive = disabled || submitDisabled

  function press(char: string) {
    keyFeedback()
    popKey(char)
    onKey(layer === 'letters' && !shift ? char.toLocaleLowerCase() : char)
    if (shift) setShift(false)
  }

  function modifierKey(
    label: ReactNode,
    onClick: () => void,
    units: number,
    ariaLabel: string,
    active = false,
    clickKind: KeyClickKind = 'key',
  ) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          keyFeedback(clickKind)
          onClick()
        }}
        aria-label={ariaLabel}
        aria-pressed={active}
        style={{
          width: spanWidth(units),
          backgroundColor: active ? UNUSED_KEY_COLOR : MODIFIER_KEY_COLOR,
          color: active ? UNUSED_KEY_TEXT : '#FFFFFF',
        }}
        className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-40 md:h-12"
      >
        {label}
      </button>
    )
  }

  return (
    // Fixed to the very bottom of the screen, like the phone's own keyboard
    // (CF6). It sits ABOVE the chat/exit fabs and the RallyHub badge — the
    // near-opaque panel simply covers them while typing.
    <div
      className="fixed inset-x-0 bottom-0 z-[10002] bg-black/85 pt-2.5 backdrop-blur-md select-none"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      {/* The panel runs to the edges, the keys keep a margin from them. */}
      <div className="mx-auto w-full max-w-2xl space-y-1.5 px-5">
        {rows.map((row, i) => {
          const lastRow = i === rows.length - 1
          return (
            <div key={i} className="flex justify-center gap-1">
              {/* Shift and delete bracket the last row, as on a phone. */}
              {layer === 'letters' && lastRow
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
                const popped = poppedKey === letter
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={disabled || locked}
                    // Commit on finger DOWN, like iOS: the letter appears the
                    // instant the key is touched, with the popped preview and
                    // click confirming the press.
                    onPointerDown={(e) => {
                      e.preventDefault()
                      if (disabled || locked) return
                      press(letter)
                    }}
                    style={{
                      ...keyStyle,
                      backgroundColor: state ? STATE_COLOR[state] : UNUSED_KEY_COLOR,
                      color: state ? STATE_TEXT[state] : UNUSED_KEY_TEXT,
                    }}
                    // Ruled-out keys keep their solid grey instead of fading, so they
                    // still read as "already tried" rather than as a rendering glitch.
                    className={`relative flex h-10 items-center justify-center rounded-md text-base font-bold transition-colors md:h-12 ${
                      layer === 'letters' && !shift ? 'lowercase' : 'uppercase'
                    } ${disabled && !locked ? 'opacity-40' : ''}`}
                  >
                    {letter}
                    {popped ? (
                      // The iOS key pop: a larger copy of the letter above the
                      // finger, so the press is visible under a thumb.
                      <span
                        aria-hidden
                        className={`pointer-events-none absolute -top-12 left-1/2 z-10 flex h-12 w-11 -translate-x-1/2 items-center justify-center rounded-lg text-3xl font-bold shadow-xl ${
                          layer === 'letters' && !shift ? 'lowercase' : 'uppercase'
                        }`}
                        style={{
                          backgroundColor: state ? STATE_COLOR[state] : UNUSED_KEY_COLOR,
                          color: state ? STATE_TEXT[state] : UNUSED_KEY_TEXT,
                        }}
                      >
                        {letter}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {lastRow
                ? modifierKey(<Delete className="size-5" />, onBackspace, 1.5, 'Delete last letter', false, 'backspace')
                : null}
            </div>
          )
        })}

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
              onClick={() => {
                keyFeedback('space')
                onKey(' ')
              }}
              aria-label="Space"
              style={{
                // Takes whatever the send key leaves, so the row always ends
                // flush with the letters above it.
                width: onSubmit ? spanWidth(4.5) : undefined,
                backgroundColor: UNUSED_KEY_COLOR,
                color: UNUSED_KEY_TEXT,
              }}
              className={`flex h-10 items-center justify-center rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-40 md:h-12 ${
                onSubmit ? 'shrink-0' : 'flex-1'
              }`}
            >
              Space
            </button>
            {onSubmit ? (
              <button
                type="button"
                disabled={submitInactive}
                onClick={() => {
                  keyFeedback('submit')
                  onSubmit()
                }}
                aria-label={submitLabel}
                style={{
                  width: spanWidth(2.5),
                  // Keeps the accent even while inactive — it is the key that
                  // sends the answer, and a grey one read as a dead control.
                  backgroundColor: accentColor ?? UNUSED_KEY_COLOR,
                  color: accentColor ? textOnAccent(accentColor) : '#FFFFFF',
                }}
                className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-50 md:h-12"
              >
                <CornerDownLeft className="size-4" />
                {submitLabel}
              </button>
            ) : null}
          </div>
      </div>
    </div>
  )
}
