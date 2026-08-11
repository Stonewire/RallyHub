import { useState } from 'react'
import { IconClose } from '@/components/icons'

import { cn } from '@/lib/utils'

type TagInputProps = {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
}

/**
 * Comma-separated tag field. Type a word and press comma or Enter to lock it
 * into a chip; Backspace on an empty input removes the last chip. Values are a
 * plain string[]; the caller owns serialisation at the DB boundary.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  'aria-label': ariaLabel,
}: TagInputProps) {
  const [draft, setDraft] = useState('')

  function addTokens(raw: string) {
    const additions = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (additions.length === 0) return
    const next = [...value]
    for (const token of additions) {
      if (!next.some((existing) => existing.toLowerCase() === token.toLowerCase())) {
        next.push(token)
      }
    }
    if (next.length !== value.length) onChange(next)
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div
      className={cn(
        'border-input bg-background flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm shadow-sm transition-colors',
        'focus-within:border-ring focus-within:ring-ring/25 focus-within:ring-2',
        disabled && 'pointer-events-none opacity-60',
      )}
      onClick={(e) => {
        // Clicking anywhere in the box focuses the text input.
        const input = e.currentTarget.querySelector('input')
        input?.focus()
      }}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={(e) => {
              e.stopPropagation()
              removeAt(i)
            }}
            className="hover:bg-destructive/15 hover:text-destructive text-muted-foreground grid size-4 place-items-center rounded-full transition-colors"
          >
            <IconClose className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={ariaLabel}
        value={draft}
        disabled={disabled}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault()
            addTokens(draft)
            setDraft('')
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            e.preventDefault()
            removeAt(value.length - 1)
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (text.includes(',')) {
            e.preventDefault()
            addTokens(text)
            setDraft('')
          }
        }}
        onBlur={() => {
          if (draft.trim()) {
            addTokens(draft)
            setDraft('')
          }
        }}
        className="text-foreground min-w-[6rem] flex-1 bg-transparent py-0.5 outline-none"
      />
    </div>
  )
}
