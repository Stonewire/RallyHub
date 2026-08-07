const TEAM_MEDIA_PERMISSION_KEY = 'rallyhub:team-media-permission-granted'

export function hasStoredMediaGrant(): boolean {
  try {
    return localStorage.getItem(TEAM_MEDIA_PERMISSION_KEY) === '1'
  } catch {
    return false
  }
}

function storeGrant() {
  try {
    localStorage.setItem(TEAM_MEDIA_PERMISSION_KEY, '1')
  } catch {
    // Ignore storage errors in private modes.
  }
}

async function isAlreadyGrantedByPermissionsApi(): Promise<boolean> {
  if (!('permissions' in navigator) || !navigator.permissions?.query) return false
  try {
    const [cameraPerm, micPerm] = await Promise.all([
      navigator.permissions.query({ name: 'camera' as PermissionName }),
      navigator.permissions.query({ name: 'microphone' as PermissionName }),
    ])
    return cameraPerm.state === 'granted' && micPerm.state === 'granted'
  } catch {
    return false
  }
}

export async function mediaPermissionsAlreadyGranted(): Promise<boolean> {
  if (hasStoredMediaGrant()) return true
  if (await isAlreadyGrantedByPermissionsApi()) {
    storeGrant()
    return true
  }
  return false
}

/** Request camera + mic once when the join app opens (user gesture not required for first prompt). */
export async function requestTeamMediaPermissions(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false
  if (await mediaPermissionsAlreadyGranted()) return true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true,
    })
    stream.getTracks().forEach((t) => t.stop())
    storeGrant()
    return true
  } catch {
    return false
  }
}

type MediaStreamConstraints = {
  video?: boolean | MediaTrackConstraints
  audio?: boolean | MediaTrackConstraints
}

/**
 * Open camera/mic for a challenge. Always ATTEMPTS getUserMedia: the callers
 * sit behind explicit taps (Take photo / Record), which are exactly where a
 * browser is allowed to show its permission prompt. The old
 * ask-permissions-first gate locked out browsers that answer the Permissions
 * API badly: iPhone Chrome reports nothing useful for camera/microphone, so
 * if the join-time prompt did not complete, every camera open returned null
 * without ever asking (Rumen's 7 Aug event, CF2-2).
 */
export async function getTeamMediaStream(
  constraints: MediaStreamConstraints,
): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    storeGrant()
    return stream
  } catch {
    return null
  }
}

/**
 * True when the browser reports camera access as hard-denied, in which case
 * another getUserMedia call will fail silently rather than re-prompt and the
 * player needs to fix it in browser settings. Unknown (unsupported API)
 * returns false.
 */
export async function cameraPermissionDenied(): Promise<boolean> {
  if (!('permissions' in navigator) || !navigator.permissions?.query) return false
  try {
    const perm = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return perm.state === 'denied'
  } catch {
    return false
  }
}
