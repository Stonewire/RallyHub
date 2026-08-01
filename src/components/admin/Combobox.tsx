import { useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ComboboxProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  autoComplete?: string
  'aria-describedby'?: string
}

/**
 * Text input with a filtered suggestion list directly beneath it.
 *
 * Replaces the native <datalist>, which the browser renders in its own style
 * and positions where it likes. Free text is still allowed: the list narrows as
 * you type but never forces a choice, so a country or city we do not list can
 * still be saved.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  autoComplete,
  'aria-describedby': describedBy,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const blurTimer = useRef<number | null>(null)

  const query = value.trim().toLowerCase()
  const matches = options.filter((option) => option.toLowerCase().includes(query))
  const visible = open && matches.length > 0

  function commit(option: string) {
    onChange(option)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={visible}
        aria-autocomplete="list"
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
          setHighlight(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Deferred so a click on an option lands before the list unmounts.
          blurTimer.current = window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={(event) => {
          if (!visible) {
            if (event.key === 'ArrowDown') setOpen(true)
            return
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlight((current) => (current + 1) % matches.length)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlight((current) => (current - 1 + matches.length) % matches.length)
          } else if (event.key === 'Enter') {
            event.preventDefault()
            commit(matches[highlight])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {visible ? (
        <ul
          role="listbox"
          className="border-input bg-popover absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border py-1 shadow-lg"
          onMouseDown={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current)
          }}
        >
          {matches.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-sm',
                  index === highlight ? 'bg-muted text-foreground' : 'text-foreground',
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => commit(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
