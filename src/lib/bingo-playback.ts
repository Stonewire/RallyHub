import type { MusicTrack } from '@/types/game-config'

/** URL used during live bingo (prefers dedicated 30s clip). */
export function bingoTrackPlaybackUrl(track: MusicTrack): string {
  return track.clipUrl?.trim() || track.audioUrl
}
