const TEAM_MEDIA_PERMISSION_KEY = 'rallyhub:team-media-permission-granted'

function hasStoredGrant(): boolean {
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

/** Request camera + mic once after a team joins so video challenges do not stall mid-game. */
export async function requestTeamMediaPermissions(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false
  if (hasStoredGrant()) return true
  if (await isAlreadyGrantedByPermissionsApi()) {
    storeGrant()
    return true
  }
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
