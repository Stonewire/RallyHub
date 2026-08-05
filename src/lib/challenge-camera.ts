import type { CSSProperties } from 'react'

import { isIOSOrIPadOS } from '@/lib/capture-platform'
import { getTeamMediaStream } from '@/lib/media-permissions'

export type ChallengeFacingMode = 'environment' | 'user'

/** Portrait photo preview — flexible height, no fixed crop. */
export const CHALLENGE_PREVIEW_MEDIA_CLASS =
  'max-h-[min(92dvh,960px)] w-full max-w-lg object-contain bg-black'

/**
 * Frame for embedded review surfaces (modals, cards).
 *
 * It used to be locked to 9:16, which is right for a phone-shot video and
 * wrong for everything else: a square submission sat in a tall black column
 * with bars top and bottom, and read as though it had been stretched. The
 * frame now takes its shape from the media inside it and only caps the height.
 */
export const CHALLENGE_VIDEO_FRAME_CLASS =
  'xp-media-frame relative mx-auto flex w-full max-w-sm items-center justify-center overflow-hidden bg-black'

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

/**
 * Media inside an embedded review frame, sized by its own aspect ratio.
 *
 * Separate from the class above because that one fills a full-bleed capture
 * screen, where capping the height would shrink the snapshot the team is
 * checking. Here the media decides the shape and only the height is bounded.
 */
export const CHALLENGE_REVIEW_MEDIA_CLASS =
  'max-h-[min(70svh,720px)] w-full object-contain'

/**
 * The live viewfinder fills its frame, the way a phone camera app does.
 * Reviewing a finished submission still uses the contain class above: there
 * the point is to see the whole frame the team actually captured.
 */
export const CHALLENGE_VIDEO_LIVE_PREVIEW_CLASS = 'size-full object-cover'

/**
 * WYSIWYG viewfinder: the stage behind it, and the media at its own aspect.
 *
 * The old cover-fit preview cropped the sensor's frame to the screen while the
 * capture kept the whole frame (Rumen's no-zoom-crop rule, 30 Jul 2026), so
 * teams framed one picture and submitted a wider one (client live test,
 * 3 Aug 2026). A video or canvas element laid out at its intrinsic size IS the
 * sensor frame: square sensor, square viewfinder; what you see is exactly what
 * is sent.
 */
export const CHALLENGE_ASPECT_FRAME_CLASS =
  'relative flex size-full items-center justify-center overflow-hidden bg-black'
export const CHALLENGE_ASPECT_TRUE_MEDIA_CLASS = 'max-h-full max-w-full'

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
  deviceId?: string,
): MediaStreamConstraints {
  const lowPowerRecording = withAudio && isAndroid()
  const video: MediaTrackConstraints & { focusMode?: string } = {
    // A chosen lens is exact: "ideal" would let the browser silently fall back
    // to whichever camera it prefers, which reads as the picker doing nothing.
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode }),
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
  deviceId?: string,
): Promise<MediaStream | null> {
  const stream = await getTeamMediaStream(
    buildChallengeVideoConstraints(facingMode, withAudio, deviceId),
  )
  if (!stream) return null

  const track = stream.getVideoTracks()[0]
  if (track && isPortraitDevice()) {
    await tryPortraitConstraints(track)
  }

  return stream
}

/**
 * Every camera the browser will admit to. Labels are only populated once
 * permission has been granted, so call this after a stream is open.
 */
export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return []
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((d) => d.kind === 'videoinput')
  } catch {
    return []
  }
}

/**
 * Facing inferred from a lens label, so the preview mirrors only for selfie
 * lenses when cycling by deviceId. Labels are free text from the OS; anything
 * that does not declare itself front-facing is treated as rear.
 */
export function facingFromDeviceLabel(label: string): ChallengeFacingMode {
  return /front|user|face|selfie/i.test(label) ? 'user' : 'environment'
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
 * Grab the current live frame into a ready-to-display canvas, synchronously.
 *
 * Split from the JPEG encode on purpose: Hermit's WebView intermittently
 * stalls canvas.toBlob for a near-constant ~13s (measured five times at
 * 13.1-13.2s on 30-31 Jul 2026, independent of scene content), while the
 * frame grab itself is ~15ms every single time. Callers show this canvas as
 * the snapshot preview immediately and run encodeCanvasToJpeg in the
 * background, so a stalled encode costs review-time nobody notices instead
 * of shutter-time everybody does.
 *
 * Deliberately NOT ImageCapture.takePhoto(): that measured 2-23s per shot on
 * the event tablets (capture-timing, 30 Jul 2026). Front-camera preview
 * mirroring stays CSS-only; the saved image matches the sensor.
 */
export function captureStillFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error('Camera frame not ready')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  drawVideoFrameToCanvas(ctx, canvas, video)
  return canvas
}

/** The upload-size JPEG for a captured frame. May stall in Hermit; see above. */
export function encodeCanvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))),
      'image/jpeg',
      PHOTO_QUALITY,
    )
  })
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
