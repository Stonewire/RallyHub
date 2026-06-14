import { canRecordVideoInBrowser } from '@/lib/video-recorder'

/** Reliable iOS / iPadOS detection (includes iPadOS desktop Safari). */
export function isIOSOrIPadOS(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return true

  // iPadOS 13+ may report MacIntel with touch.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true

  // Legacy iPad on iOS 13+.
  if (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) return true

  return false
}

export function hasGetUserMedia(): boolean {
  return Boolean(
    typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia,
  )
}

/** Native `<input capture>` for photos on iOS/iPadOS; fallback when in-app camera unavailable. */
export function shouldUseNativePhotoCapture(): boolean {
  return isIOSOrIPadOS() || !hasGetUserMedia()
}

/**
 * Native file input for video on iOS transcodes heavily (low bitrate / resolution).
 * Prefer in-app MediaRecorder with explicit high bitrate when available.
 */
export function shouldUseNativeVideoCapture(): boolean {
  if (!hasGetUserMedia()) return true
  if (isIOSOrIPadOS()) return !canRecordVideoInBrowser()
  return false
}

/** @deprecated Use shouldUseNativePhotoCapture / shouldUseNativeVideoCapture */
export function shouldUseNativeCamera(): boolean {
  return shouldUseNativePhotoCapture()
}
