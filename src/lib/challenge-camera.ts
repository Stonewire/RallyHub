import { getTeamMediaStream } from '@/lib/media-permissions'

/** Max height for live preview / review so portrait frames fit on screen. */
export const CHALLENGE_PREVIEW_MAX_HEIGHT = 'min(75dvh, 720px)'

export const CHALLENGE_PREVIEW_MEDIA_CLASS =
  'max-h-[min(75dvh,720px)] w-full object-contain bg-black'

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

export function buildChallengeVideoConstraints(
  facingMode: 'environment' | 'user',
  withAudio: boolean,
): MediaStreamConstraints {
  const video: MediaTrackConstraints & { focusMode?: string } = {
    facingMode,
    // Prefer native portrait sensor output on phones.
    width: { ideal: 1080, min: 720 },
    height: { ideal: 1920, min: 1280 },
    aspectRatio: { ideal: 9 / 16 },
    frameRate: { ideal: 30, max: 30 },
    focusMode: 'continuous',
  }

  return {
    video,
    audio: withAudio,
  }
}

export async function getChallengeCameraStream(
  facingMode: 'environment' | 'user',
  withAudio: boolean,
): Promise<MediaStream | null> {
  return getTeamMediaStream(buildChallengeVideoConstraints(facingMode, withAudio))
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

async function captureWithCanvas(
  stream: MediaStream,
  videoEl: HTMLVideoElement | null,
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
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.drawImage(video, 0, 0, w, h)

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
 * Uses ImageCapture when available; otherwise draws the native video frame to canvas.
 */
export async function captureStillPhoto(
  stream: MediaStream,
  videoEl?: HTMLVideoElement | null,
): Promise<Blob> {
  const track = stream.getVideoTracks()[0]
  if (!track) throw new Error('No camera track')

  if (imageCaptureCtor()) {
    try {
      return await captureWithImageCapture(track)
    } catch {
      // Fall back to canvas capture.
    }
  }

  return captureWithCanvas(stream, videoEl ?? null)
}
