export type Rgb = { r: number; g: number; b: number }

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(255, Math.max(0, Math.round(value)))
}

/** True for #abc and #aabbcc, with or without the leading hash. */
export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value.trim())
}

/**
 * Expands shorthand and normalises to lowercase #rrggbb. Returns null when the
 * input is not a hex colour, so callers can keep the user's raw text while they
 * are still typing rather than fighting them mid-edit.
 */
export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, '')
  if (!isValidHex(raw)) return null
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw
  return `#${full.toLowerCase()}`
}

export function hexToRgb(value: string): Rgb | null {
  const normalized = normalizeHex(value)
  if (!normalized) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

/**
 * Readable foreground for a swatch, so the hex stays legible on both a very
 * light and a very dark brand colour. Uses the standard luminance weighting
 * rather than a plain average, which would call pure blue "light".
 */
export function readableTextOn(value: string): '#ffffff' | '#1f2126' {
  const rgb = hexToRgb(value)
  if (!rgb) return '#1f2126'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.6 ? '#1f2126' : '#ffffff'
}

/** WCAG relative luminance. Not the same as the eyeball average used by
 *  readableTextOn, which is kept as-is so existing badge colours do not shift. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * WCAG contrast ratio between two colours, 1 (identical) to 21 (black on
 * white). Body text wants 4.5, large or bold text 3.
 *
 * Returns 21 when either colour cannot be parsed, so an unreadable value never
 * causes a silent downgrade of something that was fine.
 */
export function contrastRatio(foreground: string, background: string): number {
  const fg = hexToRgb(foreground)
  const bg = hexToRgb(background)
  if (!fg || !bg) return 21
  const [lighter, darker] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}
