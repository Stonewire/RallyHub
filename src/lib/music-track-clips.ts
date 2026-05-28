import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { extractAudioClip } from '@/lib/extract-audio-clip'
import { uploadAsset } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { GameConfig, MusicTrack } from '@/types/game-config'

export function bingoClipLength(config: GameConfig): 30 | 90 | null {
  const n = config.bingo_clip_length
  return n === 30 || n === 90 ? n : null
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
  clipLengthSeconds: 30 | 90,
): Promise<{ clipUrl: string; clipStartSeconds: number; clipDurationSeconds: number }> {
  const file = await fetchAudioFile(audioUrl, label)
  const duration = await readAudioDuration(file).catch(() => 0)
  const clipStart = suggestClipStart(duration)
  const extracted = await extractAudioClip(file, clipLengthSeconds, clipStart)
  const clipFile = new File(
    [extracted.blob],
    `clip-${label}.${extracted.extension}`,
    { type: extracted.mimeType },
  )
  const clipUrl = await uploadAsset(
    'game-assets',
    `${organizationId}/catalog/${crypto.randomUUID()}-clip-${clipLengthSeconds}s-${label}.${extracted.extension}`,
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
  clipLengthSeconds: 30 | 90,
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
    `${track.artist}-${track.title}.mp3`,
    clipLengthSeconds,
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
