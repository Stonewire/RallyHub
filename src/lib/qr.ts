import qrcode from 'qrcode-generator'

/**
 * QR codes, drawn here rather than fetched from a service.
 *
 * These used to come from api.qrserver.com, which meant every tablet link,
 * event link and inventory item code was sent to a third party to be drawn,
 * and none of them rendered at a venue whose wifi cannot reach the open
 * internet. A QR code is a pure function of its text; there is nothing to
 * fetch.
 *
 * Output is a PNG data URL rather than SVG because the same helper feeds the
 * printable inventory sheet, and jsPDF's addImage takes raster images only.
 */

/** Error correction level M: the usual trade-off, ~15% recoverable. */
const ERROR_CORRECTION = 'M'
/** Quiet zone, in modules. Four is what the spec asks for. */
const QUIET_ZONE = 4

// Same link and size on every render of a card, so the pixels are worth
// keeping. Bounded because the inventory grid can hold a lot of items.
const cache = new Map<string, string>()
const CACHE_LIMIT = 200

function render(text: string, size: number): string {
  const qr = qrcode(0, ERROR_CORRECTION)
  qr.addData(text)
  qr.make()

  const count = qr.getModuleCount()
  const total = count + QUIET_ZONE * 2
  // Whole pixels per module, so the code stays crisp instead of being
  // resampled into blurry edges a scanner has to guess at.
  const scale = Math.max(1, Math.floor(size / total))
  const side = total * scale

  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, side, side)
  ctx.fillStyle = '#000000'
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue
      ctx.fillRect(
        (col + QUIET_ZONE) * scale,
        (row + QUIET_ZONE) * scale,
        scale,
        scale,
      )
    }
  }

  return canvas.toDataURL('image/png')
}

/** A PNG data URL of `text` as a QR code, roughly `size` pixels square. */
export function qrCodeDataUrl(text: string, size = 200): string {
  const key = `${size}:${text}`
  const hit = cache.get(key)
  if (hit) return hit

  const url = render(text, size)
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, url)
  return url
}
