import type { CSSProperties } from 'react'

import { getTeamMediaStream } from '@/lib/media-permissions'

export type ChallengeFacingMode = 'environment' | 'user'

/** Upload size for stills. Matches downscalePhoto()'s default for file uploads. */
const PHOTO_MAX_DIM = 1600
const PHOTO_QUALITY = 0.8

/** Portrait photo preview — flexible height, no fixed crop. */
export const CHALLENGE_PREVIEW_MEDIA_CLASS =
  'max-h-[min(92dvh,960px)] w-full max-w-lg object-contain bg-black'

/** Fixed 9:16 portrait frame for video capture and review. */
export const CHALLENGE_VIDEO_FRAME_CLASS =
  'xp-media-frame relative mx-auto w-full max-w-sm aspect-[9/16] overflow-hidden bg-black'

/** Fill the 9:16 frame; minor edge crop if sensor aspect differs slightly. */
export const CHALLENGE_VIDEO_MEDIA_CLASS = 'size-full object-cover'

export function isPortraitDevice(): boolean {
  if (typeof window === 'undefined') return true
  return window.innerHeight >= window.innerWidth
}

/** Stream is landscape pixels while the device is held vertically. */
export function streamNeedsQuarterTurn(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0]
  if (!track) return false
  const { width = 0, height = 0 } = track.getSettings()
  if (!width || !height) return false
  return isPortraitDevice() && width > height
}

export function previewVideoStyle(
  facingMode: ChallengeFacingMode,
  quarterTurn: boolean,
): CSSProperties | undefined {
  const parts: string[] = []
  if (facingMode === 'user') parts.push('scaleX(-1)')
  if (quarterTurn) parts.push('rotate(90deg)')
  if (parts.length === 0) return undefined
  return { transform: parts.join(' ') }
}

/**
 * Ideal-only constraints. `min`/`exact` are HARD requirements: a portrait
 * `height: { min: 1280 }` rejects with OverconstrainedError on every 720p
 * landscape webcam (laptops, desktops) and on plenty of tablets, which killed
 * the in-app camera outright. Ideals degrade instead of failing; the portrait
 * fixups below run on the negotiated track.
 */
export function buildChallengeVideoConstraints(
  facingMode: ChallengeFacingMode,
  withAudio: boolean,
): MediaStreamConstraints {
  const video: MediaTrackConstraints & { focusMode?: string } = {
    facingMode,
    width: { ideal: 1080 },
    height: { ideal: 1920 },
    aspectRatio: { ideal: 9 / 16 },
    frameRate: { ideal: 30 },
    focusMode: 'continuous',
  }

  return {
    video,
    audio: withAudio,
  }
}

/**
 * Throws on failure; callers report mediaErrorMessage(err) and offer upload.
 *
 * The negotiated stream is used as-is, with NO reconfigure call on the live
 * track after opening it. We used to make two such calls in sequence
 * (applyMaxVideoTrackQuality, removed in V2.20.4, and a portrait-orientation
 * swap here) and both are the same failure mode on some Android hardware:
 * `applyConstraints()` on an already-flowing camera track can stall for
 * seconds or destabilize the whole pipeline for the rest of the session —
 * matching reports of a slow-to-capture photo AND a video preview that keeps
 * lagging afterward. If the sensor delivers landscape frames on a portrait
 * device, streamNeedsQuarterTurn()/previewVideoStyle() already correct that in
 * software for the live preview and captureStillPhoto() bakes the correction
 * into every photo, regardless of the track's raw orientation. Recorded VIDEO
 * FILES are the one output that is not corrected this way — MediaRecorder
 * encodes the raw track, not the rotated preview — so a landscape-sensor
 * device may record a sideways video. Needs a check on the tablet; if it
 * shows up, the fix is recording through a canvas (draw the same corrected
 * frames we already draw for stills) instead of the raw track, not resurrecting
 * this reconfigure.
 */
export async function getChallengeCameraStream(
  facingMode: ChallengeFacingMode,
  withAudio: boolean,
): Promise<MediaStream> {
  try {
    return await getTeamMediaStream(buildChallengeVideoConstraints(facingMode, withAudio))
  } catch (err) {
    // ponytail: one bare retry covers drivers that reject any resolution hint
    // and cameras with no usable facingMode. Anything past that is a real fault.
    const name = err instanceof Error ? err.name : ''
    if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err
    return getTeamMediaStream({ video: true, audio: withAudio })
  }
}

/**
 * Rotate (if the sensor is landscape while the device is upright) and scale to
 * the target size in the SAME pass. Doing it as draw-then-downscale meant
 * encoding a JPEG and immediately decoding it again to shrink it: two extra
 * full-frame passes for an image we always shrink anyway.
 */
function drawVideoFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  quarterTurn: boolean,
  maxDim: number,
): void {
  const vw = video.videoWidth
  const vh = video.videoHeight
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const rotate = quarterTurn && vw > vh
  // Output dimensions, before scaling, are swapped when the frame is rotated.
  const outW = rotate ? vh : vw
  const outH = rotate ? vw : vh
  const scale = Math.min(1, maxDim / Math.max(outW, outH))

  canvas.width = Math.round(outW * scale)
  canvas.height = Math.round(outH * scale)

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.scale(scale, scale)
  if (rotate) ctx.rotate(Math.PI / 2)
  ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
}

async function captureWithCanvas(
  stream: MediaStream,
  videoEl: HTMLVideoElement | null,
  quarterTurn: boolean,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const video = videoEl ?? document.createElement('video')
  const ownsVideo = !videoEl

  if (ownsVideo) {
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()
    await waitForVideoFrame(video)
  }

  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error('Camera frame not ready')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  drawVideoFrameToCanvas(ctx, canvas, video, quarterTurn, maxDim)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))),
      'image/jpeg',
      quality,
    )
  })

  if (ownsVideo) {
    video.srcObject = null
  }

  return blob
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Camera frame timeout')), 5000)
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    video.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error('Camera frame error'))
    }
  })
}

/**
 * Grab a still from the live preview frame.
 *
 * This deliberately does NOT use ImageCapture.takePhoto(). That asks the sensor
 * for a full-resolution shot, which on Android tablets stalls for seconds while
 * the camera reconfigures, and then needs a full-resolution rotate and a
 * full-resolution downscale on top — three heavy passes to produce a 1600px
 * image. Reading the frame already on screen is one canvas pass and feels
 * instant, and the preview is a portrait 1080x1920, which survives the 1600px
 * downscale with nothing meaningful lost.
 *
 * Preview mirroring for the front camera is CSS-only; the saved image matches
 * what the sensor produced.
 *
 * The returned blob is already at upload size, so callers must NOT run it
 * through downscalePhoto() again.
 */
export async function captureStillPhoto(
  stream: MediaStream,
  videoEl?: HTMLVideoElement | null,
  options?: { quarterTurn?: boolean; maxDim?: number; quality?: number },
): Promise<Blob> {
  const track = stream.getVideoTracks()[0]
  if (!track) throw new Error('No camera track')

  const quarterTurn = options?.quarterTurn ?? streamNeedsQuarterTurn(stream)
  return captureWithCanvas(
    stream,
    videoEl ?? null,
    quarterTurn,
    options?.maxDim ?? PHOTO_MAX_DIM,
    options?.quality ?? PHOTO_QUALITY,
  )
}

/**
 * Downscale a photo blob so its longest side is at most maxDim px. No-ops if
 * already small enough. Prefers createImageBitmap with native resize (decodes
 * and resizes in one fast step, off the main thread where supported) and falls
 * back to the canvas/<img> path. Always resolves to a usable blob — on any
 * failure it returns the original rather than throwing, so a submit is never
 * blocked by downscaling.
 */
export async function downscalePhoto(blob: Blob, maxDim = 1600, quality = 0.75): Promise<Blob> {
  if (typeof createImageBitmap === 'function') {
    let probe: ImageBitmap | null = null
    let resized: ImageBitmap | null = null
    try {
      probe = await createImageBitmap(blob)
      const { width, height } = probe
      if (width <= maxDim && height <= maxDim) return blob
      const scale = maxDim / Math.max(width, height)
      const w = Math.round(width * scale)
      const h = Math.round(height * scale)
      resized = await createImageBitmap(blob, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'high',
      })
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return blob
      ctx.drawImage(resized, 0, 0)
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
      )
      return out ?? blob
    } catch {
      return blob
    } finally {
      probe?.close()
      resized?.close()
    }
  }

  // Fallback: <img> + canvas for environments without createImageBitmap.
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode photo'))
      el.src = url
    })
    if (img.naturalWidth <= maxDim && img.naturalHeight <= maxDim) return blob
    const scale = maxDim / Math.max(img.naturalWidth, img.naturalHeight)
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(img, 0, 0, w, h)
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    )
    return out ?? blob
  } catch {
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
