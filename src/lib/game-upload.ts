import { downscalePhoto } from '@/lib/challenge-camera'
import { uploadAsset } from '@/lib/storage'

export function newGameId() {
  return crypto.randomUUID()
}

/**
 * Longest edge kept for a game image. Covers show at a few hundred pixels on a
 * library card and full width on a player's phone, so anything past this is
 * detail nobody sees, paid for by every player who loads the game.
 */
const GAME_IMAGE_MAX_DIM = 1600

/**
 * Uploads a game asset, shrinking images on the way.
 *
 * The 15MB cap alone was not enough: a current phone photo passes it
 * comfortably at 4000px wide, so covers were stored at several megabytes and
 * every player downloaded them mid-event on venue wifi. Images are scaled to a
 * sane maximum first. Audio and video pass through untouched, since a music
 * bingo track must not be re-encoded.
 */
export async function uploadGameFile(orgId: string, path: string, file: File) {
  const upload = file.type.startsWith('image/') ? await shrinkImage(file) : file
  return uploadAsset('game-assets', `${orgId}/${path}`, upload)
}

async function shrinkImage(file: File): Promise<File> {
  try {
    const blob = await downscalePhoto(file, GAME_IMAGE_MAX_DIM)
    // downscalePhoto hands back the original blob when it is already small
    // enough, in which case there is nothing to rewrap.
    if (blob === (file as Blob)) return file
    return new File([blob], file.name, { type: blob.type || file.type })
  } catch {
    // A format the canvas cannot decode is still a valid upload; the size
    // check inside uploadAsset stays as the backstop.
    return file
  }
}
