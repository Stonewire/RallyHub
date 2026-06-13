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

/** Native `<input capture>` on iOS/iPadOS; fallback when in-app camera unavailable. */
export function shouldUseNativeCamera(): boolean {
  return isIOSOrIPadOS() || !hasGetUserMedia()
}
