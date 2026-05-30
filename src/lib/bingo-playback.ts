import type { MusicTrack } from '@/types/game-config'

function readUrl(track: MusicTrack & Record<string, unknown>, camel: string, snake: string): string {
  const c = track[camel as keyof typeof track]
  if (typeof c === 'string' && c.trim()) return c.trim()
  const s = track[snake as keyof typeof track]
  if (typeof s === 'string' && s.trim()) return s.trim()
  return ''
}

/** URL used during live bingo (prefers dedicated 30s clip). */
export function bingoTrackPlaybackUrl(track: MusicTrack): string {
  const clip = readUrl(track as MusicTrack & Record<string, unknown>, 'clipUrl', 'clip_url')
  const audio = readUrl(track as MusicTrack & Record<string, unknown>, 'audioUrl', 'audio_url')
  return clip || audio
}
