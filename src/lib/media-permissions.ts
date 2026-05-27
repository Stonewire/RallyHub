/** Request camera + mic once after a team joins so video challenges do not stall mid-game. */
export async function requestTeamMediaPermissions(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true,
    })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}
