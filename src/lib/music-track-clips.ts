import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { extractAudioClip } from '@/lib/extract-audio-clip'
import { uploadAsset } from '@/lib/storage'
import { audioStorageFilename } from '@/lib/storage-path'
import { supabase } from '@/lib/supabase'
import type { GameConfig, MusicTrack } from '@/types/game-config'

export const BINGO_CLIP_LENGTHS = [30, 60, 90] as const

export type BingoClipLength = (typeof BINGO_CLIP_LENGTHS)[number]

export function bingoClipLength(config: GameConfig): BingoClipLength | null {
  return parseBingoClipLength(config.bingo_clip_length)
}

export function parseBingoClipLength(value: unknown): BingoClipLength | null {
  const n = Number(value)
  return BINGO_CLIP_LENGTHS.find((len) => len === n) ?? null
}

export function clearAllTrackClips(config: GameConfig): GameConfig {
  return {
    ...config,
    tracks: (config.tracks ?? []).map((t) => ({
      ...t,
      clipUrl: null,
      clipStartSeconds: 0,
      clipDurationSeconds: undefined,
    })),
  }
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
): Promise<{ clipUrl: string; clipStartSeconds: number; clipDurationSeconds: number }> {
  const file = await fetchAudioFile(audioUrl, audioStorageFilename(label, 'mp3'))
  const duration = await readAudioDuration(file).catch(() => 0)
  const clipStart =
    typeof inPointSeconds === 'number' && inPointSeconds >= 0
      ? inPointSeconds
      : suggestClipStart(duration)
  const extracted = await extractAudioClip(file, clipLengthSeconds, clipStart)
  const clipFilename = audioStorageFilename(`clip-${label}`, extracted.extension)
  const clipFile = new File([extracted.blob], clipFilename, { type: extracted.mimeType })
  const clipUrl = await uploadAsset(
    'game-assets',
    `${organizationId}/catalog/${crypto.randomUUID()}-clip-${clipLengthSeconds}s-${clipFilename}`,
    clipFile,
  )
  return {
    clipUrl,
    clipStartSeconds: extracted.startSeconds,
    clipDurationSeconds: clipLengthSeconds,
  }
}

export async function ensureMusicTrackClip(
  track: MusicTrack,
  organizationId: string,
  clipLengthSeconds: BingoClipLength,
): Promise<MusicTrack> {
  if (
    track.clipUrl?.trim() &&
    track.clipDurationSeconds === clipLengthSeconds
  ) {
    return track
  }
  if (!track.audioUrl?.trim()) throw new Error(`"${track.title}" has no audio file`)

  const clip = await generateClipForAudioUrl(
    organizationId,
    track.audioUrl,
    `${track.artist}-${track.title}`,
    clipLengthSeconds,
    track.clipInPointSeconds,
  )

  const { data: catalogRow } = await supabase
    .from('music_catalog')
    .select('id')
    .eq('id', track.id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (catalogRow) {
    await supabase
      .from('music_catalog')
      .update({
        clip_url: clip.clipUrl,
        clip_start_seconds: clip.clipStartSeconds,
        clip_duration_seconds: clip.clipDurationSeconds,
      })
      .eq('id', track.id)
  }

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
