/** Static brand assets in `/public` (URL paths are encoded for spaces). */
export const RALLYHUB_FULL_LOGO_PUBLIC_PATH = '/Rally hub Full Logo.png'
export const RALLYHUB_PROFILE_ICON_PUBLIC_PATH = '/rallyhub-profile-icon.png'
export const RALLYHUB_FAVICON_PUBLIC_PATH = '/favicon.png'

export type RallyBrandMark = 'full' | 'profile'

function publicAssetUrl(path: string): string {
  return encodeURI(path)
}

/** Horizontal full wordmark — admin sidebars, marketing header, auth. */
export function getRallyhubFullLogoUrl(): string {
  return publicAssetUrl(RALLYHUB_FULL_LOGO_PUBLIC_PATH)
}

/** Square mark with background — collapsed sidebar, app icon contexts. */
export function getRallyhubProfileIconUrl(): string {
  return publicAssetUrl(RALLYHUB_PROFILE_ICON_PUBLIC_PATH)
}

/** Browser tab favicon mark (no background). */
export function getRallyhubFaviconUrl(): string {
  return publicAssetUrl(RALLYHUB_FAVICON_PUBLIC_PATH)
}

export function getRallyhubBrandMarkUrl(mark: RallyBrandMark): string {
  return mark === 'profile' ? getRallyhubProfileIconUrl() : getRallyhubFullLogoUrl()
}
