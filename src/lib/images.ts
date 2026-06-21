/** Normalize storage public URLs for <img src>. */
export function resolveAssetUrl(url: string | null | undefined): string | null {
  return url?.trim() || null
}
