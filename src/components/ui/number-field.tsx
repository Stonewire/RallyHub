import { useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'

type NumberFieldProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> & {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
}

/**
 * The app's number input (CF3-20, 8 Aug). Two things the native pattern got
 * wrong at real events:
 *
 * - Deleting: every onChange used to coerce '' to a fallback instantly, so
 *   the last digit could never be removed. Here the field may sit empty (or
 *   hold a half-typed value) while focused; the parsed, clamped number is
 *   committed as soon as it parses, and blur snaps the text back to the
 *   committed value.
 * Scroll-wheel edits are killed globally in main.tsx (wheel blurs any focused
 * number input), so this component only handles the typing side.
 */
export function NumberField({ value, onChange, min, max, ...rest }: NumberFieldProps) {
  // null: show the committed value. A string: the user is mid-edit.
  const [draft, setDraft] = useState<string | null>(null)

  function clamp(n: number): number {
    if (min != null && n < min) return min
    if (max != null && n > max) return max
    return n
  }

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        const parsed = Number(raw)
        if (raw.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed))
      }}
      onBlur={() => setDraft(null)}
      {...rest}
    />
  )
}
