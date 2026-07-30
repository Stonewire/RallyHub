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
 * Open camera/mic for a challenge without re-prompting when permission was already granted.
 * Does not request permission — call requestTeamMediaPermissions() once at app open.
 */
export async function getTeamMediaStream(
  constraints: MediaStreamConstraints,
): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null
  if (!(await mediaPermissionsAlreadyGranted())) return null
  try {
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch {
    return null
  }
}
