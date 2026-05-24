import type { Json } from '@/types/json'
import type { EventStage } from '@/types/game-config'
import type { GameConfig, MusicTrack, QuizQuestion } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

export type DisplayLayout = 'rank_list' | 'orbit_view'
export type TeamStatus = 'idle' | 'active' | 'stopped'
export type AnnouncementTarget = 'display' | 'participants' | 'both'

export type LiveEventBundle = {
  event: Tables<'events'>
  organization: Tables<'organizations'> | null
  state: Tables<'event_state'>
  teams: Tables<'teams'>[]
  games: Tables<'games'>[]
  submissions: Tables<'submissions'>[]
}

export function parseStages(raw: Json | null | undefined): EventStage[] {
  if (!Array.isArray(raw)) return []
  return raw as EventStage[]
}

export function currentStage(
  stages: EventStage[],
  index: number,
): EventStage | null {
  return stages[index] ?? null
}

export function brandColorsForEvent(
  event: Tables<'events'>,
  org: Tables<'organizations'> | null,
): [string, string, string] {
  if (event.branding_enabled && Array.isArray(event.brand_colors)) {
    const c = event.brand_colors as string[]
    if (c.length >= 3) return [c[0], c[1], c[2]]
  }
  if (org) {
    return [org.primary_color, org.secondary_color, org.accent_color]
  }
  return ['#3E3D3E', '#6f6f6f', '#FFCB03']
}

export function logoForEvent(
  event: Tables<'events'>,
  org: Tables<'organizations'> | null,
): string | null {
  if (event.branding_enabled && event.logo_url) return event.logo_url
  return org?.logo_url ?? null
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function gamePointsLabel(game: Tables<'games'>): string {
  if (game.points_type === 'range') {
    return `MAX ${game.points_max ?? 0}`
  }
  return String(game.points_static ?? 0)
}

export function quizQuestions(game: Tables<'games'>): QuizQuestion[] {
  const config = (game.config ?? {}) as GameConfig
  return config.questions ?? []
}

export function bingoTracks(game: Tables<'games'>): MusicTrack[] {
  const config = (game.config ?? {}) as GameConfig
  return config.tracks ?? []
}

/** Deterministic 25-cell bingo card from team + game. */
export function bingoCardTitles(
  teamId: string,
  tracks: MusicTrack[],
): string[] {
  const titles = tracks.map((t) => `${t.title} — ${t.artist}`)
  const out: string[] = []
  let seed = 0
  for (let i = 0; i < teamId.length; i++) seed += teamId.charCodeAt(i)
  const pool = [...titles]
  for (let i = 0; i < 25; i++) {
    if (pool.length === 0) {
      out.push(`Square ${i + 1}`)
      continue
    }
    const idx = (seed + i * 7) % pool.length
    out.push(pool[idx])
    pool.splice(idx, 1)
  }
  return out
}

export const FACILITATOR_NAME_KEY = 'rallyhub_facilitator_name'
export const PARTICIPANT_TEAM_KEY = 'rallyhub_team_id'
