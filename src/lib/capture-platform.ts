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

/**
 * Android phone, as opposed to an Android tablet.
 *
 * Android Chrome puts "Mobile" in a phone's user agent and leaves it off a
 * tablet's. The event tablets never reach this check anyway: they run
 * desktop-mode UAs with no Android token at all, which is exactly why the
 * capture attribute degraded to a file browser on them (join-photo report,
 * 30 Jul 2026).
 */
export function isAndroidPhone(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /Mobile/i.test(ua)
}

/**
 * Native `<input capture>` for photos: iOS/iPadOS, Android phones, and any
 * browser without getUserMedia. The system camera app beats the in-app one
 * wherever the capture attribute genuinely opens it — teams get their own
 * camera's UI, HDR and lens switching. Tablets keep the in-app camera because
 * their desktop-mode browsers turn the attribute into a plain file browser.
 * Video stays in-app everywhere Android: the system camera cannot enforce the
 * game's time limit.
 */
export function shouldUseNativePhotoCapture(): boolean {
  return isIOSOrIPadOS() || isAndroidPhone() || !hasGetUserMedia()
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
