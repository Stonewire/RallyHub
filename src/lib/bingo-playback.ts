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

/**
 * Where the room is in the song that is playing right now (R2.4 sync).
 *
 * The audible clip only ever plays on the facilitator's device, so the audience
 * display cannot analyse it: it loads the same clip and analyses that copy
 * silently. Without an anchor that copy starts at 0:00 whenever the display
 * notices the state flip, which on an anonymous display can be a whole 4s poll
 * late, and a display opened or reloaded mid-song stayed out for the rest of
 * the track.
 *
 * `atMs` is the writing device's wall clock. Both ends are network-time synced
 * in practice, and even a second of skew is far better than the seconds of
 * drift this replaces.
 */
export type BingoTrackAnchor = {
  /** The track the position belongs to. An anchor for any other track is ignored. */
  trackId: string
  positionSeconds: number
  /** Epoch millis, taken on the facilitator's device at the moment of measuring. */
  atMs: number
  paused: boolean
}

/** Drift a display puts up with before correcting, in seconds. */
export const BINGO_SYNC_TOLERANCE_SECONDS = 0.75

/**
 * An anchor older than this is junk rather than something to seek to: a row
 * left over from an earlier round would otherwise send the display's copy far
 * past the end of the clip.
 */
const MAX_ANCHOR_AGE_SECONDS = 900

/** Read the jsonb column back, tolerating anything an older client left there. */
export function parseBingoTrackAnchor(raw: unknown): BingoTrackAnchor | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const trackId = typeof a.trackId === 'string' ? a.trackId.trim() : ''
  if (!trackId) return null
  const positionSeconds = typeof a.positionSeconds === 'number' ? a.positionSeconds : Number.NaN
  const atMs = typeof a.atMs === 'number' ? a.atMs : Number.NaN
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return null
  if (!Number.isFinite(atMs) || atMs <= 0) return null
  return { trackId, positionSeconds, atMs, paused: a.paused === true }
}

/**
 * Stable identity for React deps and effect keys: the parsed anchor is a fresh
 * object on every poll, so passing it around directly would churn.
 */
export function bingoTrackAnchorKey(anchor: BingoTrackAnchor | null): string {
  if (!anchor) return 'none'
  return `${anchor.trackId}|${anchor.positionSeconds}|${anchor.atMs}|${anchor.paused ? 1 : 0}`
}

export type BingoAnchorTargetParams = {
  anchor: BingoTrackAnchor | null
  /** The track the reader is playing. Must match, or the anchor is not ours. */
  trackId: string | null
  nowMs: number
  /** Clip length when known, so an anchor past the end can be rejected. */
  durationSeconds?: number | null
}

/** Seconds into the clip the room is at right now, or null when unusable. */
export function bingoAnchorTargetSeconds({
  anchor,
  trackId,
  nowMs,
  durationSeconds,
}: BingoAnchorTargetParams): number | null {
  if (!anchor || !trackId || anchor.trackId !== trackId) return null
  const elapsedSeconds = anchor.paused ? 0 : (nowMs - anchor.atMs) / 1000
  // A stamp from the future by more than ordinary clock jitter, or one old
  // enough to belong to an earlier round, says nothing useful.
  if (elapsedSeconds < -2 || elapsedSeconds > MAX_ANCHOR_AGE_SECONDS) return null
  const target = anchor.positionSeconds + Math.max(0, elapsedSeconds)
  if (
    typeof durationSeconds === 'number' &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    target > durationSeconds
  ) {
    // The room is already past the end of this clip (mid-crossfade, say).
    // Seeking to the tail would only stall the analyser.
    return null
  }
  return target
}

export type BingoSyncSeekParams = BingoAnchorTargetParams & {
  /** Where the reader's own copy currently is. */
  currentSeconds: number
  toleranceSeconds?: number
}

/**
 * Where to seek the display's silent copy, or null to leave it alone.
 *
 * Correcting only past a tolerance matters: the copy is never heard, so a
 * sub-second error costs nothing, while seeking on every check would make the
 * bars stutter as the element re-buffers each time.
 */
export function bingoSyncSeekSeconds({
  currentSeconds,
  toleranceSeconds = BINGO_SYNC_TOLERANCE_SECONDS,
  ...target
}: BingoSyncSeekParams): number | null {
  const seconds = bingoAnchorTargetSeconds(target)
  if (seconds === null) return null
  if (!Number.isFinite(currentSeconds)) return seconds
  if (Math.abs(seconds - currentSeconds) <= toleranceSeconds) return null
  return seconds
}
