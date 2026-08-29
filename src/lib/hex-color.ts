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

/** WCAG relative luminance: weighted and linearised, not a channel average. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a > b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Ink that reads best on `background`: whichever of `darkInk` and white wins on
 * contrast. Comparing the two ratios IS the threshold, so the crossover always
 * matches the ink actually being used. A hand-picked cut-off drifts out of step
 * with it the moment either colour changes, and a band of mid-dark brands then
 * takes white where the dark ink was measurably better.
 *
 * Linearised luminance matters here: a saturated green and a saturated blue of
 * the same average brightness need opposite ink, and only the weighted-then-
 * linearised version gets that right.
 */
export function readableInkOn<T extends string>(
  background: string,
  darkInk: T,
): T | '#ffffff' {
  const bg = hexToRgb(background)
  const ink = hexToRgb(darkInk)
  if (!bg || !ink) return darkInk
  const bgLuminance = relativeLuminance(bg)
  return contrastRatio(bgLuminance, relativeLuminance(ink)) >=
    contrastRatio(bgLuminance, 1)
    ? darkInk
    : '#ffffff'
}

/**
 * @deprecated Use `textOnAccent` from `@/lib/live-event`, the one helper every
 * brand-painted surface asks. This keeps its own darker ink so its test file
 * still passes; delete the two together.
 */
export function readableTextOn(value: string): '#ffffff' | '#1f2126' {
  return readableInkOn(value, '#1f2126')
}
