import type { CSSProperties } from 'react'

import { getTeamMediaStream } from '@/lib/media-permissions'

export type ChallengeFacingMode = 'environment' | 'user'

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

export function buildChallengeVideoConstraints(
  facingMode: ChallengeFacingMode,
  withAudio: boolean,
): MediaStreamConstraints {
  const video: MediaTrackConstraints & { focusMode?: string } = {
    facingMode,
    width: { ideal: 1080, min: 720 },
    height: { ideal: 1920, min: 1280 },
    aspectRatio: { ideal: 9 / 16 },
    frameRate: { ideal: 30 },
    focusMode: 'continuous',
  }

  return {
    video,
    audio: withAudio,
  }
}

async function tryPortraitConstraints(track: MediaStreamTrack): Promise<void> {
  const { width = 0, height = 0 } = track.getSettings()
  if (!width || !height || width <= height) return
  try {
    await track.applyConstraints({
      width: { ideal: Math.min(width, height) },
      height: { ideal: Math.max(width, height) },
      aspectRatio: { ideal: 9 / 16 },
    })
  } catch {
    // Keep the stream as-is; preview/capture will correct orientation.
  }
}

/**
 * The negotiated stream is used at its requested ~1080x1920 size, deliberately
 * NOT reconfigured to the sensor's maximum. Device evidence (record-timing,
 * 30 Jul 2026): the max-resolution reconfigure pushed the event tablet's track
 * to 3120x2448 and the recording preview to a measured 3fps, with the hardware
 * mp4 encoder collapsing under 18Mbps of 7.6MP frames. At the negotiated size
 * the bitrate computed from real track dimensions (~5Mbps at 1080p) is well
 * within what the hardware handles.
 */
export async function getChallengeCameraStream(
  facingMode: ChallengeFacingMode,
  withAudio: boolean,
): Promise<MediaStream | null> {
  const stream = await getTeamMediaStream(buildChallengeVideoConstraints(facingMode, withAudio))
  if (!stream) return null

  const track = stream.getVideoTracks()[0]
  if (track && isPortraitDevice()) {
    await tryPortraitConstraints(track)
  }

  return stream
}

/** Upload size for stills. Matches downscalePhoto()'s target for file uploads. */
const PHOTO_MAX_DIM = 1600
const PHOTO_QUALITY = 0.8

/**
 * Rotate (when the sensor delivers landscape on an upright device) and scale
 * to upload size in the SAME canvas pass. Draw-then-downscale would encode a
 * JPEG only to immediately decode and shrink it: two extra full-frame passes,
 * measured at ~1.1s each shot on the event tablets.
 */
function drawVideoFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  quarterTurn: boolean,
): void {
  const vw = video.videoWidth
  const vh = video.videoHeight
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  const rotate = quarterTurn && vw > vh
  const outW = rotate ? vh : vw
  const outH = rotate ? vw : vh
  const scale = Math.min(1, PHOTO_MAX_DIM / Math.max(outW, outH))

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

  drawVideoFrameToCanvas(ctx, canvas, video, quarterTurn)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))),
      'image/jpeg',
      PHOTO_QUALITY,
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
 * Deliberately does NOT use ImageCapture.takePhoto(): device evidence
 * (client_diagnostics capture-timing, 30 Jul 2026) measured that call at 2 to
 * 23 SECONDS per shot on the event tablets, producing a 3-4MB full-res still
 * that was then shrunk to ~130KB anyway. Reading the frame already on screen
 * is one canvas pass at upload size and orientation.
 *
 * Preview mirroring for the front camera is CSS-only; the saved image matches
 * the sensor output. The returned blob is already at upload size, so callers
 * must NOT run it through downscalePhoto() again.
 */
export async function captureStillPhoto(
  stream: MediaStream,
  videoEl?: HTMLVideoElement | null,
  options?: { quarterTurn?: boolean },
): Promise<Blob> {
  const track = stream.getVideoTracks()[0]
  if (!track) throw new Error('No camera track')

  const quarterTurn = options?.quarterTurn ?? streamNeedsQuarterTurn(stream)
  return captureWithCanvas(stream, videoEl ?? null, quarterTurn)
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
