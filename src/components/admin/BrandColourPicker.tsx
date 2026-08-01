import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  hexToRgb,
  normalizeHex,
  readableTextOn,
  rgbToHex,
  type Rgb,
} from '@/lib/hex-color'

type BrandColourPickerProps = {
  id: string
  label: string
  description?: string
  value: string
  onChange: (hex: string) => void
}

const CHANNELS: { key: keyof Rgb; label: string }[] = [
  { key: 'r', label: 'R' },
  { key: 'g', label: 'G' },
  { key: 'b', label: 'B' },
]

/**
 * The design's brand colour control: a round swatch that opens a popover with a
 * hex field and R/G/B sliders.
 *
 * The hex box keeps the user's raw text while they type and only commits once
 * the value parses, so backspacing to edit a colour does not fight them by
 * snapping back on every keystroke.
 */
export function BrandColourPicker({
  id,
  label,
  description,
  value,
  onChange,
}: BrandColourPickerProps) {
  const [open, setOpen] = useState(false)
  // null means "show the committed value". Only holds text while the user is
  // mid-edit, so a half-typed hex is not overwritten on every keystroke and no
  // effect is needed to mirror the prop.
  const [draft, setDraft] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocumentClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 }
  const shown = draft ?? value

  function commitDraft(next: string) {
    setDraft(next)
    const normalized = normalizeHex(next)
    if (normalized) onChange(normalized)
  }

  function endEditing() {
    setDraft(null)
  }

  function setChannel(key: keyof Rgb, channelValue: number) {
    onChange(rgbToHex({ ...rgb, [key]: channelValue }))
  }

  return (
    <div ref={boxRef} className="relative flex min-w-0 flex-col items-center gap-1.5 text-center">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} colour, currently ${value}`}
        className="border-border size-9 shrink-0 rounded-full border-2"
        style={{ backgroundColor: value }}
      />
      <Label htmlFor={id} className="text-foreground text-xs">
        {label}
      </Label>
      <Input
        value={shown}
        onChange={(event) => commitDraft(event.target.value)}
        onBlur={endEditing}
        className="h-6 w-full px-1.5 text-center font-mono text-[11px] uppercase"
        aria-label={`${label} hex value`}
      />
      {description ? (
        <p className="text-muted-foreground text-[10px] leading-tight">{description}</p>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label={`${label} colour picker`}
          className="border-border bg-card absolute top-11 left-1/2 z-40 w-56 -translate-x-1/2 rounded-lg border p-3 text-left shadow-xl"
        >
          <div
            className="mb-3 flex h-12 items-center justify-center rounded-md font-mono text-xs font-semibold"
            style={{ backgroundColor: value, color: readableTextOn(value) }}
          >
            {value.toUpperCase()}
          </div>

          <Label htmlFor={`${id}-hex`} className="text-muted-foreground text-[10px] uppercase">
            Hex
          </Label>
          <Input
            id={`${id}-hex`}
            value={shown}
            onChange={(event) => commitDraft(event.target.value)}
            onBlur={endEditing}
            className="mb-3 h-8 font-mono text-xs uppercase"
          />

          {CHANNELS.map(({ key, label: channelLabel }) => (
            <div key={key} className="mb-2 flex items-center gap-2">
              <span className="text-muted-foreground w-3 text-[10px] font-bold">
                {channelLabel}
              </span>
              <input
                type="range"
                min={0}
                max={255}
                value={rgb[key]}
                onChange={(event) => setChannel(key, Number(event.target.value))}
                aria-label={`${label} ${channelLabel} channel`}
                className="accent-primary min-w-0 flex-1"
              />
              <span className="text-muted-foreground w-7 text-right text-[10px] tabular-nums">
                {rgb[key]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
