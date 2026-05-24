/** Filename in `/public`; URL is encoded below for browsers. */
export const RALLYHUB_FULL_LOGO_PUBLIC_PATH = '/Rally hub Full Logo.png'

/** Full logo for <img src> */
export function getRallyhubFullLogoUrl(): string {
  return encodeURI(RALLYHUB_FULL_LOGO_PUBLIC_PATH)
}
