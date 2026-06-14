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

type ImageCaptureInstance = {
  takePhoto: (settings?: PhotoSettings) => Promise<Blob>
  getPhotoCapabilities?: () => Promise<PhotoCapabilities>
}

type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureInstance

function imageCaptureCtor(): ImageCaptureConstructor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as Window & { ImageCapture?: ImageCaptureConstructor }).ImageCapture
  return ctor ?? null
}

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

/** Request the highest resolution the device exposes (portrait-oriented when applicable). */
export async function applyMaxVideoTrackQuality(track: MediaStreamTrack): Promise<void> {
  const caps = track.getCapabilities?.()
  if (!caps) return

  const maxW = caps.width?.max
  const maxH = caps.height?.max
  if (!maxW || !maxH) return

  let targetWidth = maxW
  let targetHeight = maxH
  if (isPortraitDevice() && maxW > maxH) {
    targetWidth = maxH
    targetHeight = maxW
  }

  try {
    await track.applyConstraints({
      width: { ideal: targetWidth },
      height: { ideal: targetHeight },
      aspectRatio: { ideal: 9 / 16 },
      frameRate: { ideal: 30 },
    })
  } catch {
    // Keep negotiated stream settings.
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

export async function getChallengeCameraStream(
  facingMode: ChallengeFacingMode,
  withAudio: boolean,
): Promise<MediaStream | null> {
  const stream = await getTeamMediaStream(buildChallengeVideoConstraints(facingMode, withAudio))
  if (!stream) return null

  const track = stream.getVideoTracks()[0]
  if (track) {
    await applyMaxVideoTrackQuality(track)
    if (isPortraitDevice()) {
      await tryPortraitConstraints(track)
    }
  }

  return stream
}

async function captureWithImageCapture(track: MediaStreamTrack): Promise<Blob> {
  const ctor = imageCaptureCtor()
  if (!ctor) throw new Error('ImageCapture unavailable')

  const capture = new ctor(track)
  const photoSettings: PhotoSettings = {}

  if (capture.getPhotoCapabilities) {
    try {
      const caps = await capture.getPhotoCapabilities()
      if (caps.imageWidth?.max) photoSettings.imageWidth = caps.imageWidth.max
      if (caps.imageHeight?.max) photoSettings.imageHeight = caps.imageHeight.max
    } catch {
      // Use defaults from takePhoto()
    }
  }

  const settings = track.getSettings()
  if (!photoSettings.imageWidth && settings.width) {
    photoSettings.imageWidth = settings.width
  }
  if (!photoSettings.imageHeight && settings.height) {
    photoSettings.imageHeight = settings.height
  }

  return capture.takePhoto(photoSettings)
}

function drawVideoFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  quarterTurn: boolean,
): void {
  const vw = video.videoWidth
  const vh = video.videoHeight
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  if (quarterTurn && vw > vh) {
    canvas.width = vh
    canvas.height = vw
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
    return
  }

  canvas.width = vw
  canvas.height = vh
  ctx.drawImage(video, 0, 0, vw, vh)
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
      0.95,
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
 * Capture a full-resolution still from the live camera stream.
 * Preview mirroring for front camera is CSS-only; saved image matches sensor output.
 */
export async function captureStillPhoto(
  stream: MediaStream,
  videoEl?: HTMLVideoElement | null,
  options?: { quarterTurn?: boolean },
): Promise<Blob> {
  const track = stream.getVideoTracks()[0]
  if (!track) throw new Error('No camera track')

  const quarterTurn = options?.quarterTurn ?? streamNeedsQuarterTurn(stream)

  if (imageCaptureCtor()) {
    try {
      const blob = await captureWithImageCapture(track)
      if (!quarterTurn) return blob
      // ImageCapture may still return landscape on some Android devices — rotate via canvas.
      return await rotatePhotoBlob(blob, true)
    } catch {
      // Fall back to canvas capture.
    }
  }

  return captureWithCanvas(stream, videoEl ?? null, quarterTurn)
}

async function rotatePhotoBlob(blob: Blob, quarterTurn: boolean): Promise<Blob> {
  if (!quarterTurn) return blob
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode photo'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    canvas.width = img.height
    canvas.height = img.width
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))),
        'image/jpeg',
        0.95,
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
