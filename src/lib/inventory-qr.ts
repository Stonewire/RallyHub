const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Extract only the opaque item code; scanned hosts are never navigated to. */
export function inventoryCodeFromQrValue(value: string): string | null {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/^\/inventory\/item\/([^/]+)\/?$/)
    if (!match) return null
    const code = decodeURIComponent(match[1])
    return UUID_PATTERN.test(code) ? code : null
  } catch {
    return null
  }
}
