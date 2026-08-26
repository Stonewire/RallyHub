import { ArrowBigUp, CornerDownLeft, Delete } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  NUMBER_ROWS,
  SYMBOL_ROWS,
  keyVariantsForLanguage,
  keyboardColumns,
  letterRowsFor,
  type KeyboardAlphabet,
} from '@/lib/keyboard-layouts'
import { textOnAccent } from '@/lib/live-event'
import { playKeyClickSound, type KeyClickKind } from '@/lib/sounds'
import type { WordleCellState } from '@/lib/puzzle-engine'

// Letter rows, per-language long-press variants and the column count all live
// in src/lib/keyboard-layouts.ts as data: one component, one sizing system,
// every language follows the same QWERTY-style pattern.

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

/** How long a finger holds a key before its variant bubble pops. */
const LONG_PRESS_MS = 450
/** Variant bubble geometry, in px: square options in a small floating tray. */
const BUBBLE_OPTION = 44
const BUBBLE_GAP = 4
const BUBBLE_PAD = 4
/** Gap between the bubble's bottom edge and the top of the held key. */
const BUBBLE_LIFT = 6

type Layer = 'letters' | 'numbers' | 'symbols'

type HoldState = {
  pointerId: number
  letter: string
  /** Base letter first, then its accents: the bubble in reading order. */
  options: string[]
  el: HTMLButtonElement
  downX: number
  downY: number
  moved: boolean
  bubbleOpen: boolean
  highlight: number
  timer: number
}

type BubbleState = {
  options: string[]
  /** Panel-relative px, for rendering inside the fixed panel. */
  left: number
  top: number
  /** Viewport-relative px, for hit-testing the sliding finger. */
  viewportLeft: number
  highlight: number
  /** slide: finger still down, release picks. tap: released in place, tap picks. */
  mode: 'slide' | 'tap'
}

type Props = {
  alphabet: KeyboardAlphabet
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
  submitLabel,
  accentColor,
  keyState,
  disabled,
}: Props) {
  const { t, i18n } = useTranslation('live')
  const submitText = submitLabel ?? t('puzzle.submit')
  // Answers are compared exactly, so case is the player's to choose. Starts on
  // for the first letter, then releases itself, like a phone keyboard.
  const [shift, setShift] = useState(true)
  const [layer, setLayer] = useState<Layer>('letters')
  // The key currently under a finger, for the iOS-style popped-up preview.
  const [poppedKey, setPoppedKey] = useState<string | null>(null)
  const popTimerRef = useRef<number | null>(null)
  // A long-press in flight (variant keys only), and its popped bubble.
  const holdRef = useRef<HoldState | null>(null)
  const [bubble, setBubble] = useState<BubbleState | null>(null)

  // Accents follow the language the phone is reading the event in.
  const variantMap = keyVariantsForLanguage(i18n.language)

  useEffect(() => {
    return () => {
      if (popTimerRef.current != null) window.clearTimeout(popTimerRef.current)
      if (holdRef.current) window.clearTimeout(holdRef.current.timer)
    }
  }, [])

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

  const letterRows = letterRowsFor(alphabet)
  const rows =
    layer === 'letters' ? letterRows : layer === 'numbers' ? NUMBER_ROWS : SYMBOL_ROWS

  /**
   * iPhone-style sizing: every key on the board is exactly the same width,
   * derived from the widest letter row of the active alphabet. Shorter rows
   * centre with an inset instead of stretching or shrinking.
   */
  const cols = keyboardColumns(alphabet)
  const keyWidth = `calc((100% - ${cols - 1} * 0.25rem) / ${cols})`

  /** Width of a key spanning `units` letter keys, gaps included. */
  function spanWidth(units: number) {
    return `calc(${keyWidth} * ${units} + ${(units - 1) * 0.25}rem)`
  }

  const keyStyle: CSSProperties = { width: keyWidth }
  const submitInactive = disabled || submitDisabled

  /** Sends the character through, honouring shift, and releases shift. */
  function commitChar(char: string) {
    onKey(layer === 'letters' && !shift ? char.toLocaleLowerCase() : char)
    if (shift) setShift(false)
  }

  function press(char: string) {
    keyFeedback()
    popKey(char)
    commitChar(char)
  }

  function clearHold() {
    if (holdRef.current) window.clearTimeout(holdRef.current.timer)
    holdRef.current = null
  }

  /** Swaps the key pop for the variant bubble once the hold matures. */
  function openBubble(hold: HoldState, panel: HTMLElement) {
    const keyRect = hold.el.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const count = hold.options.length
    const width = BUBBLE_PAD * 2 + count * BUBBLE_OPTION + (count - 1) * BUBBLE_GAP
    const height = BUBBLE_PAD * 2 + BUBBLE_OPTION
    const centre = keyRect.left + keyRect.width / 2
    const viewportLeft = Math.min(
      Math.max(centre - width / 2, 8),
      Math.max(8, panelRect.width - width - 8),
    )
    hold.bubbleOpen = true
    setPoppedKey(null)
    setBubble({
      options: hold.options,
      left: viewportLeft - panelRect.left,
      top: keyRect.top - panelRect.top - height - BUBBLE_LIFT,
      viewportLeft,
      highlight: 0,
      mode: 'slide',
    })
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
    // (CF6). It sits ABOVE the chat/exit fabs and the RallyHub badge: the
    // near-opaque panel simply covers them while typing.
    <div
      className="fixed inset-x-0 bottom-0 z-[10002] bg-black/85 pt-2.5 backdrop-blur-md select-none"
      style={{
        paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
        // The panel owns every gesture on it, so a sliding finger picks a
        // variant instead of scrolling the page behind the keyboard.
        touchAction: 'none',
      }}
      // Forgiving hit targets, like a real phone keyboard (CF9): the whole
      // panel takes the pointer-down and routes it to the NEAREST letter key,
      // so a thumb landing in a gap or a couple of pixels off still types.
      // Commits on finger DOWN, like iOS, except on keys that carry accent
      // variants: those commit on release, so a ~450ms hold can pop the
      // variant bubble first. Modifier keys keep their own handlers; a miss
      // near them falls through to the closest letter only when it is
      // genuinely close.
      onPointerDown={(e) => {
        if (disabled) return
        // The same pointer cannot be down twice, so a hold still recorded
        // under this id is stale (a missed pointerup): sweep it first.
        if (holdRef.current?.pointerId === e.pointerId) {
          clearHold()
          setBubble((current) => (current?.mode === 'slide' ? null : current))
        }
        const target = e.target as HTMLElement
        // A bubble left open by a still hold: tapping an option types it,
        // tapping anywhere else just puts the bubble away.
        if (bubble?.mode === 'tap') {
          e.preventDefault()
          const option = target.closest('button[data-kb-variant]') as HTMLButtonElement | null
          setBubble(null)
          if (option) {
            keyFeedback()
            commitChar(option.dataset.kbVariant!)
          }
          return
        }
        // Direct hit on a letter key: press it (letters have no handler of
        // their own, this delegate is the only path).
        const direct = target.closest('button[data-kb]') as HTMLButtonElement | null
        if (direct) {
          if (!direct.disabled) {
            e.preventDefault()
            const letter = direct.dataset.kb!
            const variants = layer === 'letters' ? variantMap[letter] : undefined
            if (variants?.length) {
              // Same click and key pop as any other press; the letter itself
              // lands on release, once we know it was a tap and not a hold.
              keyFeedback()
              popKey(letter)
              clearHold()
              const panel = e.currentTarget as HTMLElement
              try {
                panel.setPointerCapture(e.pointerId)
              } catch {
                // Very old browsers: the hold still works while the pointer
                // stays over the panel, which a thumb on a keyboard does.
              }
              const hold: HoldState = {
                pointerId: e.pointerId,
                letter,
                options: [letter, ...variants],
                el: direct,
                downX: e.clientX,
                downY: e.clientY,
                moved: false,
                bubbleOpen: false,
                highlight: 0,
                timer: window.setTimeout(() => {
                  if (holdRef.current === hold) openBubble(hold, panel)
                }, LONG_PRESS_MS),
              }
              holdRef.current = hold
            } else {
              press(letter)
            }
          }
          return
        }
        // Any other real button (modifiers, space, submit) handles itself.
        if (target.closest('button')) return
        e.preventDefault()
        const panel = e.currentTarget as HTMLElement
        let best: HTMLButtonElement | null = null
        let bestDistance = Infinity
        for (const el of panel.querySelectorAll<HTMLButtonElement>('button[data-kb]')) {
          if (el.disabled) continue
          const r = el.getBoundingClientRect()
          const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
          const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
          const d = Math.hypot(dx, dy)
          if (d < bestDistance) {
            bestDistance = d
            best = el
          }
        }
        // Half a key of forgiveness; further away than that was not a typo.
        if (best && bestDistance <= 22) press(best.dataset.kb!)
      }}
      onPointerMove={(e) => {
        const hold = holdRef.current
        if (!hold || e.pointerId !== hold.pointerId) return
        if (Math.hypot(e.clientX - hold.downX, e.clientY - hold.downY) > 10) hold.moved = true
        if (!hold.bubbleOpen) return
        // Sliding sideways under the bubble highlights the nearest option.
        setBubble((current) => {
          if (!current) return current
          const count = current.options.length
          const index = Math.min(
            count - 1,
            Math.max(
              0,
              Math.floor(
                (e.clientX - current.viewportLeft - BUBBLE_PAD) / (BUBBLE_OPTION + BUBBLE_GAP),
              ),
            ),
          )
          hold.highlight = index
          return index === current.highlight ? current : { ...current, highlight: index }
        })
      }}
      onPointerUp={(e) => {
        const hold = holdRef.current
        if (!hold || e.pointerId !== hold.pointerId) return
        clearHold()
        if (!hold.bubbleOpen) {
          // A quick tap: the base letter, exactly as on every other key.
          commitChar(hold.letter)
          return
        }
        if (hold.moved) {
          // Slid across the bubble: release picks the highlighted option.
          keyFeedback()
          commitChar(hold.options[hold.highlight] ?? hold.letter)
          setBubble(null)
        } else {
          // Held still and let go: leave the bubble up to be tapped.
          setBubble((current) => (current ? { ...current, mode: 'tap' } : current))
        }
      }}
      onPointerCancel={(e) => {
        const hold = holdRef.current
        if (!hold || e.pointerId !== hold.pointerId) return
        clearHold()
        setBubble(null)
        setPoppedKey(null)
      }}
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
                    t('puzzle.shift'),
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
                    data-kb={letter}
                    style={{
                      ...keyStyle,
                      backgroundColor: state ? STATE_COLOR[state] : UNUSED_KEY_COLOR,
                      color: state ? STATE_TEXT[state] : UNUSED_KEY_TEXT,
                    }}
                    // Ruled-out keys keep their solid grey instead of fading, so they
                    // still read as "already tried" rather than as a rendering glitch.
                    className={`relative flex h-10 shrink-0 items-center justify-center rounded-md text-base font-bold transition-colors md:h-12 ${
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
                ? modifierKey(<Delete className="size-5" />, onBackspace, 1.5, t('puzzle.deleteLastLetter'), false, 'backspace')
                : null}
            </div>
          )
        })}

        <div className="flex justify-center gap-1 pt-1">
            {modifierKey(
              layer === 'letters' ? '123' : 'ABC',
              () => setLayer(layer === 'letters' ? 'numbers' : 'letters'),
              1.5,
              layer === 'letters' ? t('puzzle.numbers') : t('puzzle.letters'),
            )}
            {modifierKey(
              layer === 'symbols' ? '123' : '#+=',
              () => setLayer(layer === 'symbols' ? 'numbers' : 'symbols'),
              1.5,
              t('puzzle.characters'),
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                keyFeedback('space')
                onKey(' ')
              }}
              aria-label={t('puzzle.space')}
              style={{
                backgroundColor: UNUSED_KEY_COLOR,
                color: UNUSED_KEY_TEXT,
              }}
              // Takes whatever the other keys leave, so the row always ends
              // flush with the letters above it, whatever the column count.
              className="flex h-10 flex-1 items-center justify-center rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-40 md:h-12"
            >
              {t('puzzle.space')}
            </button>
            {onSubmit ? (
              <button
                type="button"
                disabled={submitInactive}
                onClick={() => {
                  keyFeedback('submit')
                  onSubmit()
                }}
                aria-label={submitText}
                style={{
                  width: spanWidth(2.5),
                  // Keeps the accent even while inactive: it is the key that
                  // sends the answer, and a grey one read as a dead control.
                  backgroundColor: accentColor ?? UNUSED_KEY_COLOR,
                  color: accentColor ? textOnAccent(accentColor) : '#FFFFFF',
                }}
                className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-bold uppercase active:scale-95 disabled:opacity-50 md:h-12"
              >
                <CornerDownLeft className="size-4" />
                {submitText}
              </button>
            ) : null}
          </div>
      </div>

      {bubble ? (
        // The iPhone-style variant bubble: base letter first, accents after,
        // floating just above the held key. While the finger is still down it
        // is purely visual (slide highlights, release picks); once released in
        // place its options become real, tappable buttons.
        <div
          aria-hidden={bubble.mode === 'slide'}
          className="absolute z-20 flex items-center rounded-xl bg-white shadow-xl"
          style={{
            left: bubble.left,
            top: bubble.top,
            padding: BUBBLE_PAD,
            gap: BUBBLE_GAP,
          }}
        >
          {bubble.options.map((option, index) => (
            <button
              key={option}
              type="button"
              tabIndex={bubble.mode === 'tap' ? 0 : -1}
              data-kb-variant={option}
              aria-label={option}
              className={`flex items-center justify-center rounded-lg text-2xl font-bold ${
                !shift ? 'lowercase' : 'uppercase'
              }`}
              style={{
                width: BUBBLE_OPTION,
                height: BUBBLE_OPTION,
                // Brand gold with charcoal text on the highlighted option.
                backgroundColor: index === bubble.highlight ? '#FFC107' : '#FFFFFF',
                color: '#1C1917',
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
