/** Static brand assets in `/public/brand` (RallyHub brand identity). */

export type RallyBrandMark = 'full' | 'wordmark' | 'profile'
export type RallyBrandTheme = 'light' | 'dark'

/** Logo variants keyed by theme. Charcoal art for light surfaces, Ivory for dark. */
const LOGO_FULL = {
  light: '/brand/logo-full-charcoal.png',
  dark: '/brand/logo-full-ivory.png',
} as const

const LOGO_WORDMARK = {
  light: '/brand/logo-wordmark-charcoal.png',
  dark: '/brand/logo-wordmark-ivory.png',
} as const

const LOGO_ICON = {
  light: '/brand/icon-charcoal.png',
  dark: '/brand/icon-ivory.png',
} as const

export const RALLYHUB_ICON_YELLOW_PATH = '/brand/icon-yellow.png'
export const RALLYHUB_FAVICON_PUBLIC_PATH = '/brand/icon-yellow.png'

/** Brand pattern assets (subtle, low-contrast backgrounds). */
export const RALLYHUB_PATTERN_BARS = '/brand/pattern-bars.png'
export const RALLYHUB_PATTERN_ARCS = '/brand/pattern-arcs.png'
export const RALLYHUB_PATTERN_DOTS = '/brand/pattern-dots.png'

function encode(path: string): string {
  return encodeURI(path)
}

/** Horizontal full wordmark with slogan — marketing hero, auth. */
export function getRallyhubFullLogoUrl(theme: RallyBrandTheme = 'light'): string {
  return encode(LOGO_FULL[theme])
}

/** Compact wordmark (no slogan) — admin sidebars, marketing header. */
export function getRallyhubWordmarkUrl(theme: RallyBrandTheme = 'light'): string {
  return encode(LOGO_WORDMARK[theme])
}

/** Square icon mark — collapsed sidebar, app icon contexts. */
export function getRallyhubIconUrl(theme: RallyBrandTheme = 'light'): string {
  return encode(LOGO_ICON[theme])
}

/** Browser tab favicon mark. */
export function getRallyhubFaviconUrl(): string {
  return encode(RALLYHUB_FAVICON_PUBLIC_PATH)
}

export function getRallyhubBrandMarkUrl(
  mark: RallyBrandMark,
  theme: RallyBrandTheme = 'light',
): string {
  if (mark === 'profile') return getRallyhubIconUrl(theme)
  if (mark === 'wordmark') return getRallyhubWordmarkUrl(theme)
  return getRallyhubFullLogoUrl(theme)
}
