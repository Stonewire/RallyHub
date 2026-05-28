import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { extractAudioClipWav } from '@/lib/extract-audio-clip'
import { uploadAsset } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { MusicTrack } from '@/types/game-config'

const CLIP_DURATION = 30

async function fetchAudioFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download ${filename}`)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'audio/mpeg' })
}

/** Build a 30s clip from full audio and upload to game-assets. */
export async function generateClipForAudioUrl(
  organizationId: string,
  audioUrl: string,
  label: string,
): Promise<{ clipUrl: string; clipStartSeconds: number; clipDurationSeconds: number }> {
  const file = await fetchAudioFile(audioUrl, label)
  const duration = await readAudioDuration(file).catch(() => 0)
  const clipStart = suggestClipStart(duration)
  const clipBlob = await extractAudioClipWav(file, clipStart, CLIP_DURATION)
  const clipFile = new File([clipBlob], `clip-${label}.wav`, { type: 'audio/wav' })
  const clipUrl = await uploadAsset(
    'game-assets',
    `${organizationId}/catalog/${crypto.randomUUID()}-clip-${label}`,
    clipFile,
  )
  return {
    clipUrl,
    clipStartSeconds: clipStart,
    clipDurationSeconds: CLIP_DURATION,
  }
}

/** Ensure a game track has clipUrl; updates music_catalog when track id matches a catalog row. */
export async function ensureMusicTrackClip(
  track: MusicTrack,
  organizationId: string,
): Promise<MusicTrack> {
  if (track.clipUrl?.trim()) return track
  if (!track.audioUrl?.trim()) throw new Error(`"${track.title}" has no audio file`)

  const clip = await generateClipForAudioUrl(
    organizationId,
    track.audioUrl,
    `${track.artist}-${track.title}.mp3`,
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
