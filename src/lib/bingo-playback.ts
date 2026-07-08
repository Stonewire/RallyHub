import { ensureLiveEventAccess } from '@/lib/live-event-access'
import { supabase } from '@/lib/supabase'
import type { GameConfig, MusicTrack } from '@/types/game-config'

function readUrl(track: Record<string, unknown>, camel: string, snake: string): string {
  const c = track[camel]
  if (typeof c === 'string' && c.trim()) return c.trim()
  const s = track[snake]
  if (typeof s === 'string' && s.trim()) return s.trim()
  return ''
}

function parseGameConfig(raw: unknown): GameConfig {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as GameConfig
    } catch {
      return {}
    }
  }
  return (raw ?? {}) as GameConfig
}

/** Normalize a track row from games.config.tracks (camelCase or snake_case). */
export function normalizeMusicTrack(raw: unknown): MusicTrack | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const id = typeof t.id === 'string' ? t.id : String(t.id ?? '')
  if (!id) return null
  const clipUrl = readUrl(t, 'clipUrl', 'clip_url')
  const audioUrl = readUrl(t, 'audioUrl', 'audio_url')
  return {
    id,
    title: typeof t.title === 'string' ? t.title : String(t.title ?? ''),
    artist: typeof t.artist === 'string' ? t.artist : String(t.artist ?? ''),
    audioUrl,
    clipUrl: clipUrl || undefined,
    clipStartSeconds:
      typeof t.clipStartSeconds === 'number'
        ? t.clipStartSeconds
        : typeof t.clip_start_seconds === 'number'
          ? t.clip_start_seconds
          : undefined,
    clipDurationSeconds:
      typeof t.clipDurationSeconds === 'number'
        ? t.clipDurationSeconds
        : typeof t.clip_duration_seconds === 'number'
          ? t.clip_duration_seconds
          : undefined,
  }
}

export function musicTracksFromGameConfig(config: unknown): MusicTrack[] {
  const parsed = parseGameConfig(config)
  const raw = parsed.tracks
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry != null)
    .map(normalizeMusicTrack)
    .filter((t): t is MusicTrack => t !== null && Boolean(t.id))
}

/** Latest playlist from DB (bypasses stale live-event bundle cache). */
export async function fetchMusicTracksForGame(
  eventId: string,
  gameId: string,
): Promise<MusicTrack[]> {
  await ensureLiveEventAccess(eventId)
  const { data, error } = await supabase.rpc('get_live_event_games', {
    p_event_id: eventId,
  })
  if (error) throw error
  const game = ((data ?? []) as { id: string; config: unknown }[]).find((g) => g.id === gameId)
  return musicTracksFromGameConfig(game?.config)
}

/** URL used during live bingo (prefers dedicated clip, then full audio). */
export function bingoTrackPlaybackUrl(track: MusicTrack): string {
  const normalized = normalizeMusicTrack(track) ?? track
  const clip = normalized.clipUrl?.trim() ?? ''
  const audio = normalized.audioUrl?.trim() ?? ''
  return clip || audio
}

/**
 * True once a song is within its reveal-lead window (locks marks, scores the
 * round, reveals green/red) before the crossfade to the next song starts.
 *
 * Deliberately has NO lower bound. `timeupdate` firing isn't guaranteed at any
 * particular rate (MDN: "the exact frequency... is left up to the user
 * agent"), and a busy/throttled tab can skip a tick straight over a narrow
 * window. The previous version required `remaining > crossfadeSeconds`,
 * which meant a skipped tick silently deferred scoring+reveal until AFTER
 * the entire crossfade finished — the new song already audible while the
 * previous one's cells were still stuck pending ("stays yellow for a
 * while"). Callers must still de-dupe with their own per-song "already
 * triggered" flag; this only answers "should it fire on THIS tick."
 */
export function shouldTriggerBingoLockAndReveal(
  remainingSeconds: number,
  revealLeadSeconds: number,
): boolean {
  return remainingSeconds >= 0 && remainingSeconds <= revealLeadSeconds
}
