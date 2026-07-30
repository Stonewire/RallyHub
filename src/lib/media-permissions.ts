/**
 * Camera / mic access for participant capture.
 *
 * Permission is requested at the moment the participant taps a capture button,
 * inside the user gesture — never up front on page load. Browsers (Chrome on
 * Android in particular) suppress or auto-dismiss gesture-less prompts, and a
 * suppressed prompt used to leave capture permanently dead with no way back.
 */

/** Turn a getUserMedia rejection into something a participant can act on. */
export function mediaErrorMessage(err: unknown, allowUpload = true): string {
  const name =
    err instanceof Error ? err.name : ((err as { name?: string } | null)?.name ?? '')
  const upload = allowUpload ? ' or upload a file instead' : ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera blocked. Allow camera access for this site in your browser settings, then try again'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return `No usable camera found on this device${upload}`
    case 'NotReadableError':
    case 'TrackStartError':
      return `Camera is already in use by another app. Close it and try again${upload}`
    default:
      return `Could not open the camera${upload}`
  }
}

/** True when the browser exposes a camera API at all (needs a secure context). */
export function canOpenCamera(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

/**
 * Open a camera/mic stream. Throws on failure — callers show
 * mediaErrorMessage(err) and fall back to file upload.
 */
export async function getTeamMediaStream(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  if (!canOpenCamera()) {
    throw Object.assign(new Error('getUserMedia unavailable'), { name: 'NotFoundError' })
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}
