import type { Json } from '@/types/json'
import type { EventStage } from '@/types/game-config'
import type { GameConfig, MusicTrack, QuizQuestion } from '@/types/game-config'
import type { TenantPublicOrg } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

export type DisplayLayout = 'rank_list' | 'orbit_view'
export type TeamStatus = 'idle' | 'active' | 'stopped'
export type AnnouncementTarget = 'display' | 'participants' | 'both'

export type LiveEventBundle = {
  event: Tables<'events'>
  organization: TenantPublicOrg | null
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
  org: TenantPublicOrg | Tables<'organizations'> | null,
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
  org: TenantPublicOrg | Tables<'organizations'> | null,
): string | null {
  if (event.logo_url) return event.logo_url
  return org?.logo_url ?? null
}

/** [primary, secondary, accent] */
export function brandBlobColors(
  event: Tables<'events'>,
  org: TenantPublicOrg | Tables<'organizations'> | null,
): { base: string; primary: string; accent: string } {
  const [primary, secondary, accent] = brandColorsForEvent(event, org)
  return { base: secondary, primary, accent }
}

export function isEventLive(event: Tables<'events'>): boolean {
  return event.status === 'active'
}

export function gamePointsDisplay(game: Tables<'games'>): string {
  if (game.points_type === 'range') {
    return `Up to ${game.points_max ?? 0}`
  }
  return `${game.points_static ?? 0} pts`
}

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Break / stage timers: always M:SS (e.g. 5:00 for five minutes). */
export function formatBreakTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function breakDurationSeconds(
  stage: { durationMinutes?: number } | null,
  storedSeconds: number | null | undefined,
): number {
  if (storedSeconds != null && storedSeconds >= 60) return storedSeconds
  return (stage?.durationMinutes ?? 5) * 60
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

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Unique 25-cell bingo card per team from playlist (needs 25+ tracks). */
export function bingoCardTitles(teamId: string, tracks: MusicTrack[]): string[] {
  const titles = tracks.map((t) => `${t.title} — ${t.artist}`)
  if (titles.length < 25) {
    return Array.from({ length: 25 }, (_, i) => titles[i % titles.length] ?? `Song ${i + 1}`)
  }
  let seed = 0
  for (let i = 0; i < teamId.length; i++) seed += teamId.charCodeAt(i)
  return shuffleWithSeed(titles, seed).slice(0, 25)
}

export const FACILITATOR_NAME_KEY = 'rallyhub_facilitator_name'
export const PARTICIPANT_TEAM_KEY = 'rallyhub_team_id'
