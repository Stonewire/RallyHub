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
  return raw.map(normalizeMusicTrack).filter((t): t is MusicTrack => t !== null)
}

/** Latest playlist from DB (bypasses stale live-event bundle cache). */
export async function fetchMusicTracksForGame(gameId: string): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('games')
    .select('config')
    .eq('id', gameId)
    .maybeSingle()
  if (error) throw error
  return musicTracksFromGameConfig(data?.config)
}

/** URL used during live bingo (prefers dedicated clip, then full audio). */
export function bingoTrackPlaybackUrl(track: MusicTrack): string {
  const normalized = normalizeMusicTrack(track) ?? track
  const clip = normalized.clipUrl?.trim() ?? ''
  const audio = normalized.audioUrl?.trim() ?? ''
  return clip || audio
}
