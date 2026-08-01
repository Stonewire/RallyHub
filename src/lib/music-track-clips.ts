import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { extractAudioClip } from '@/lib/extract-audio-clip'
import { uploadAsset } from '@/lib/storage'
import { audioStorageFilename } from '@/lib/storage-path'
import { supabase } from '@/lib/supabase'
import type { GameConfig, MusicTrack } from '@/types/game-config'

export const BINGO_CLIP_LENGTHS = [30, 60, 90] as const

export type BingoClipLength = (typeof BINGO_CLIP_LENGTHS)[number]

/**
 * Clip length for a game, defaulting to 30s. The music catalog already stores
 * its clips at 30s, so an unset game matches the clips it would be given.
 */
export function bingoClipLength(config: GameConfig): BingoClipLength {
  return parseBingoClipLength(config.bingo_clip_length) ?? 30
}

export function parseBingoClipLength(value: unknown): BingoClipLength | null {
  const n = Number(value)
  return BINGO_CLIP_LENGTHS.find((len) => len === n) ?? null
}

async function fetchAudioFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download ${filename}`)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'audio/mpeg' })
}

export async function generateClipForAudioUrl(
  organizationId: string,
  audioUrl: string,
  label: string,
  clipLengthSeconds: BingoClipLength,
  /** Organiser's marked in point. null/undefined falls back to the suggestion. */
  inPointSeconds?: number | null,
  /**
   * Fires at each real step (download, cut, upload) so a caller can draw a fill
   * that actually tracks the work rather than an invented percentage.
   */
  onProgress?: (fraction: number) => void,
): Promise<{ clipUrl: string; clipStartSeconds: number; clipDurationSeconds: number }> {
  const file = await fetchAudioFile(audioUrl, audioStorageFilename(label, 'mp3'))
  onProgress?.(0.2)
  const duration = await readAudioDuration(file).catch(() => 0)
  const clipStart =
    typeof inPointSeconds === 'number' && inPointSeconds >= 0
      ? inPointSeconds
      : suggestClipStart(duration)
  const extracted = await extractAudioClip(file, clipLengthSeconds, clipStart)
  onProgress?.(0.7)
  const clipFilename = audioStorageFilename(`clip-${label}`, extracted.extension)
  const clipFile = new File([extracted.blob], clipFilename, { type: extracted.mimeType })
  const clipUrl = await uploadAsset(
    'game-assets',
    `${organizationId}/catalog/${crypto.randomUUID()}-clip-${clipLengthSeconds}s-${clipFilename}`,
    clipFile,
  )
  onProgress?.(1)
  return {
    clipUrl,
    clipStartSeconds: extracted.startSeconds,
    clipDurationSeconds: clipLengthSeconds,
  }
}

/**
 * Cuts the clip this game needs for a track.
 *
 * Clips belong to the game, not to the catalog: a game running 60s must not
 * overwrite the catalog's 30s clip and change what every other game plays.
 * The catalog is only read here, for the organiser's marked in point, which
 * always wins over the automatic suggestion.
 */
export async function ensureMusicTrackClip(
  track: MusicTrack,
  organizationId: string,
  clipLengthSeconds: BingoClipLength,
  onProgress?: (fraction: number) => void,
): Promise<MusicTrack> {
  if (
    track.clipUrl?.trim() &&
    track.clipDurationSeconds === clipLengthSeconds
  ) {
    return track
  }
  if (!track.audioUrl?.trim()) throw new Error(`"${track.title}" has no audio file`)

  // Read live rather than trusting the copy taken when the track was added, so
  // an in point marked in the library since then is the one that is used.
  const { data: catalogRow } = await supabase
    .from('music_catalog')
    .select('clip_in_point_seconds')
    .eq('id', track.id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const inPoint =
    catalogRow?.clip_in_point_seconds == null
      ? track.clipInPointSeconds
      : Number(catalogRow.clip_in_point_seconds)

  const clip = await generateClipForAudioUrl(
    organizationId,
    track.audioUrl,
    `${track.artist}-${track.title}`,
    clipLengthSeconds,
    inPoint,
    onProgress,
  )

  return {
    ...track,
    clipUrl: clip.clipUrl,
    clipStartSeconds: clip.clipStartSeconds,
    clipDurationSeconds: clip.clipDurationSeconds,
  }
}

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
