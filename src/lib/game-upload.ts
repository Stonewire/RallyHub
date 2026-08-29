import { downscalePhoto } from '@/lib/challenge-camera'
import { uploadAsset } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

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

const GAME_ASSETS_MARKER = '/game-assets/'

/**
 * Duplicates a game asset so a copied question owns its own file.
 *
 * Question media lives at a path keyed by the question id and is uploaded with
 * upsert, so two questions sharing a URL are not two copies: re-uploading on
 * one silently rewrites the other. Anything that clones a question has to
 * clone the object too.
 *
 * Returns the new public URL, or null when the URL is not one of ours (an
 * external link, a YouTube video) and there is nothing to copy.
 */
export async function copyGameFile(publicUrl: string, orgId: string, path: string) {
  const marker = publicUrl.indexOf(GAME_ASSETS_MARKER)
  if (marker < 0) return null
  const from = decodeURIComponent(publicUrl.slice(marker + GAME_ASSETS_MARKER.length).split('?')[0])
  // Keep the extension: Storage serves the content type it stored, but the
  // path is what the rest of the app reads a kind from.
  const dot = from.lastIndexOf('.')
  const ext = dot > from.lastIndexOf('/') ? from.slice(dot) : ''
  const to = `${orgId}/${path}${ext}`
  const { error } = await supabase.storage.from('game-assets').copy(from, to)
  if (error) throw error
  return supabase.storage.from('game-assets').getPublicUrl(to).data.publicUrl
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
