import { isAllowedImageUploadType } from '@/lib/upload-limits'

/**
 * Logo normalisation at upload time (FIX-ROUND-1 P1.3).
 *
 * Organisers upload logos at wildly different sizes: a 200px favicon-grade
 * PNG and a 6000px print asset both used to land in storage untouched, so
 * logos rendered inconsistently on the live screens. Normalising here means
 * every logo in storage sits in the same size band: contained within a
 * 1024x1024 box, with small images enlarged to fit but never beyond 2x
 * (blowing a tiny raster up further just makes it blurry).
 *
 * Transparency is preserved: images with any transparent pixel re-encode as
 * PNG, since a logo on the live surfaces floats over a brand background.
 * Fully opaque images re-encode as JPEG.
 *
 * Fail-safe like downscalePhoto in challenge-camera.ts: any decode or encode
 * failure returns the original file, so normalisation can never block an
 * upload.
 */

/** Logos are contained within this square bounding box, in pixels. */
export const LOGO_BOX_SIZE = 1024

/** Small logos are enlarged to fit the box, but never beyond this factor. */
export const LOGO_MAX_UPSCALE = 2

/** Logos carry hard edges and text, so encode above the photo quality. */
const LOGO_JPEG_QUALITY = 0.85

/** JPEG cannot carry an alpha channel, so the transparency scan is skipped. */
const OPAQUE_SOURCE_TYPES = new Set(['image/jpeg', 'image/pjpeg'])

/**
 * The size a logo should be stored at, or null when the image is already the
 * right size and re-encoding it would only cost quality.
 */
export function logoTargetSize(
  width: number,
  height: number,
): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  const scale = Math.min(LOGO_MAX_UPSCALE, LOGO_BOX_SIZE / Math.max(width, height))
  if (scale === 1) return null
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function hasTransparentPixel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const data = ctx.getImageData(0, 0, width, height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

/** The stored extension must match the re-encoded type, not the original. */
function logoFileName(originalName: string, mime: 'image/png' | 'image/jpeg'): string {
  const base = originalName.replace(/\.[^.]*$/, '') || 'logo'
  return `${base}.${mime === 'image/png' ? 'png' : 'jpg'}`
}

/**
 * Resize an uploaded logo into the standard bounding box. Returns the
 * original file untouched when it is already the right size, when the type is
 * not an accepted raster image (the bucket allowlist rejects those anyway),
 * or when anything about decoding or encoding fails.
 */
export async function normaliseLogoImage(file: File): Promise<File> {
  if (!isAllowedImageUploadType(file)) return file
  if (typeof createImageBitmap !== 'function') return file

  let source: ImageBitmap | null = null
  let resized: ImageBitmap | null = null
  try {
    source = await createImageBitmap(file)
    const target = logoTargetSize(source.width, source.height)
    if (!target) return file

    resized = await createImageBitmap(source, {
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
    })

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(resized, 0, 0)

    const keepAlpha =
      !OPAQUE_SOURCE_TYPES.has(file.type) &&
      hasTransparentPixel(ctx, target.width, target.height)
    const mime = keepAlpha ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, LOGO_JPEG_QUALITY),
    )
    if (!blob) return file
    return new File([blob], logoFileName(file.name, mime), { type: mime })
  } catch {
    return file
  } finally {
    source?.close()
    resized?.close()
  }
}
