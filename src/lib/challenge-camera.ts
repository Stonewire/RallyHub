import type { CSSProperties } from 'react'

import { isIOSOrIPadOS } from '@/lib/capture-platform'
import { getTeamMediaStream } from '@/lib/media-permissions'

export type ChallengeFacingMode = 'environment' | 'user'

/** Portrait photo preview — flexible height, no fixed crop. */
export const CHALLENGE_PREVIEW_MEDIA_CLASS =
  'max-h-[min(92dvh,960px)] w-full max-w-lg object-contain bg-black'

/** Fixed 9:16 portrait frame for embedded review surfaces (modals, cards). */
export const CHALLENGE_VIDEO_FRAME_CLASS =
  'xp-media-frame relative mx-auto w-full max-w-sm aspect-[9/16] overflow-hidden bg-black'

/**
 * Full-bleed capture container: the live camera uses the whole available
 * screen, so a landscape-sensor tablet's letterboxed wide view renders as
 * large as the display allows instead of inside a narrow phone-shaped column
 * (too-small-to-frame report, 30 Jul 2026).
 */
export const CHALLENGE_CAPTURE_FRAME_CLASS =
  'relative size-full overflow-hidden bg-black'

/**
 * Show the WHOLE frame inside the 9:16 window, letterboxed on black where the
 * sensor is wider than the window. Used by photo and video capture so a
 * landscape-sensor tablet is not zoom-cropped (full field of view, no quality
 * loss from blowing up a slice).
 */
export const CHALLENGE_VIDEO_MEDIA_CONTAIN_CLASS = 'size-full object-contain'

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
 * Recording (withAudio) runs camera, preview, and encoder at once. The 720p
 * recording request is ANDROID-ONLY, calibrated by device evidence
 * (record-timing, 30 Jul 2026): the event tablet's preview measured 9fps even
 * at 1080p, and unknown Android hardware gets the same safe floor. iPhones
 * and iPads are known-good camera hardware and asking them for 720x1280 made
 * Safari pick a wide low-resolution mode (horizontal, soft preview reported
 * 30 Jul 2026), so iOS keeps the full 1080x1920 portrait request. Photo opens
 * without audio and grabs one still, so it uses 1080p everywhere.
 *
 * Ideal-only sizes: `min` is a HARD requirement that rejects with
 * OverconstrainedError on cameras that cannot meet it (every 720p landscape
 * laptop webcam), killing capture outright. Ideals degrade instead of failing.
 */
export function buildChallengeVideoConstraints(
  facingMode: ChallengeFacingMode,
  withAudio: boolean,
): MediaStreamConstraints {
  const lowPowerRecording = withAudio && isAndroid()
  const video: MediaTrackConstraints & { focusMode?: string } = {
    facingMode,
    width: { ideal: lowPowerRecording ? 720 : 1080 },
    height: { ideal: lowPowerRecording ? 1280 : 1920 },
    aspectRatio: { ideal: 9 / 16 },
    frameRate: { ideal: 30 },
    focusMode: 'continuous',
  }

  return {
    video,
    audio: withAudio,
  }
}

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

async function tryPortraitConstraints(track: MediaStreamTrack): Promise<void> {
  const { width = 0, height = 0 } = track.getSettings()
  if (!width || !height || width <= height) return

  // iOS Safari ignores ideal-only portrait hints and stays in its landscape
  // camera mode (horizontal iPhone video, reported 30 Jul 2026 after the old
  // post-open reconfigure was removed for the Android tablet's sake). An
  // `exact` demand flips it; if the device truly cannot, the catch keeps the
  // stream as-is. Android stays on ideals: its drivers either honour them or
  // deliver upright-content wide frames where forcing would be wrong.
  if (isIOSOrIPadOS()) {
    try {
      await track.applyConstraints({
        width: { exact: Math.min(width, height) },
        height: { exact: Math.max(width, height) },
      })
      return
    } catch {
      // Fall through to the polite attempt below.
    }
  }

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
 * Scale the FULL live frame to upload size in one canvas pass. No cropping
 * and no rotation: the event tablet's sensor is landscape-mounted and
 * delivers upright content in wide frames, and Rumen's call (30 Jul 2026) is
 * to keep the whole field of view rather than zoom-crop it to portrait.
 * Phones with portrait sensors deliver portrait frames and are unaffected.
 */
function drawVideoFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
): void {
  const vw = video.videoWidth
  const vh = video.videoHeight

  const scale = Math.min(1, PHOTO_MAX_DIM / Math.max(vw, vh))
  canvas.width = Math.round(vw * scale)
  canvas.height = Math.round(vh * scale)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(video, 0, 0, vw, vh, 0, 0, canvas.width, canvas.height)
}

/**
 * Per-shot stage durations, for the Hermit WebView investigation: three real
 * shots measured 13.2s almost to the millisecond (31 Jul 2026), a signature
 * of a hidden timeout, and this breakdown names the stage that owns it.
 */
export type CaptureStages = {
  setupMs: number
  drawMs: number
  encodeMs: number
  ownedVideo: boolean
}

async function captureWithCanvas(
  stream: MediaStream,
  videoEl: HTMLVideoElement | null,
  onStages?: (stages: CaptureStages) => void,
): Promise<Blob> {
  const started = performance.now()
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

  const beforeDraw = performance.now()
  drawVideoFrameToCanvas(ctx, canvas, video)
  const afterDraw = performance.now()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))),
      'image/jpeg',
      PHOTO_QUALITY,
    )
  })
  const afterEncode = performance.now()

  if (ownsVideo) {
    video.srcObject = null
  }

  onStages?.({
    setupMs: Math.round(beforeDraw - started),
    drawMs: Math.round(afterDraw - beforeDraw),
    encodeMs: Math.round(afterEncode - afterDraw),
    ownedVideo: ownsVideo,
  })

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
 * the sensor output. The returned blob is the full frame at upload size, so
 * callers must NOT run it through downscalePhoto() again.
 */
export async function captureStillPhoto(
  stream: MediaStream,
  videoEl?: HTMLVideoElement | null,
  onStages?: (stages: CaptureStages) => void,
): Promise<Blob> {
  const track = stream.getVideoTracks()[0]
  if (!track) throw new Error('No camera track')

  return captureWithCanvas(stream, videoEl ?? null, onStages)
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
