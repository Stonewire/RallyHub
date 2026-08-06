import type { Json } from '@/types/json'
import type { EventStage } from '@/types/game-config'
import { musicTracksFromGameConfig } from '@/lib/bingo-playback'
import type { GameConfig, MusicTrack, QuizQuestion } from '@/types/game-config'
import { supabase } from '@/lib/supabase'
import type { TenantPublicOrg } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

import { publishLiveBundleReload } from '@/lib/live-broadcast'

export type DisplayLayout = 'rank_list' | 'orbit_view'
export type DisplayTextColor = 'black' | 'white'

/** Quiz / bingo “stand by” highlight — not event branding. */
export const STANDBY_ACCENT = '#FFC107'

export function textOnAccent(accentHex: string): string {
  const hex = accentHex.replace('#', '').slice(0, 6)
  if (hex.length !== 6) return '#3E3D3E'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#3E3D3E' : '#ffffff'
}

export function displayTextColorForEvent(
  event: Tables<'events'>,
): DisplayTextColor {
  return event.display_text_color === 'black' ? 'black' : 'white'
}

export function displayTextClass(event: Tables<'events'>): string {
  return displayTextColorForEvent(event) === 'black' ? 'text-black' : 'text-white'
}

/** Quiz question countdown (falls back to legacy timer_seconds when column missing). */
export function quizTimerSeconds(state: Tables<'event_state'>): number {
  const row = state as Tables<'event_state'> & {
    quiz_timer_seconds?: number | null
  }
  if (row.quiz_timer_seconds != null) return row.quiz_timer_seconds
  return state.timer_seconds
}

export function quizTimerRunning(state: Tables<'event_state'>): boolean {
  const row = state as Tables<'event_state'> & {
    quiz_timer_running?: boolean
  }
  if (row.quiz_timer_running != null) return row.quiz_timer_running
  return state.timer_running
}

export function submissionsAllowed(state: Tables<'event_state'>): boolean {
  return state.submissions_open !== false
}
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
  return (raw as (EventStage | null | undefined)[]).filter(
    (stage): stage is EventStage =>
      Boolean(stage && typeof stage.id === 'string' && stage.type),
  )
}

export function currentStage(
  stages: EventStage[],
  index: number,
): EventStage | null {
  return stages[index] ?? null
}

export const DEFAULT_BRAND_COLORS: [string, string, string] = [
  '#3E3D3E',
  '#6f6f6f',
  '#FFC107',
]

function brandColorSlot(value: unknown): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return trimmed
}

/** Normalize any brand color array to [primary, secondary, accent]. */
export function normalizeBrandColorTriple(
  raw: Json | unknown,
  defaults: [string, string, string] = DEFAULT_BRAND_COLORS,
): [string, string, string] {
  const slots = Array.isArray(raw)
    ? raw.map(brandColorSlot).filter((c): c is string => c !== null)
    : []

  if (slots.length >= 3) {
    return [slots[0], slots[1], slots[2]]
  }
  if (slots.length === 2) {
    // Legacy saves used filter(Boolean) and dropped an empty/missing primary slot.
    return [defaults[0], slots[0], slots[1]]
  }
  if (slots.length === 1) {
    return [slots[0], slots[0], defaults[2]]
  }
  return defaults
}

function brandColorsFromJson(
  raw: Json | null | undefined,
): [string, string, string] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  return normalizeBrandColorTriple(raw)
}

/** [primary, secondary, accent] from organization profile columns. */
export function brandColorsFromOrg(
  org:
    | Pick<
        Tables<'organizations'>,
        'primary_color' | 'secondary_color' | 'accent_color'
      >
    | TenantPublicOrg
    | null
    | undefined,
): [string, string, string] {
  if (!org) return DEFAULT_BRAND_COLORS
  return normalizeBrandColorTriple([
    org.primary_color,
    org.secondary_color,
    org.accent_color,
  ])
}

/** Resolve [primary, secondary, accent] for event experience screens. */
export function brandColorsForEvent(
  event: Tables<'events'>,
  org: TenantPublicOrg | Tables<'organizations'> | null,
): [string, string, string] {
  const eventColors = brandColorsFromJson(event.brand_colors)
  const orgColors = org ? brandColorsFromOrg(org) : null

  if (event.branding_enabled) {
    return eventColors ?? orgColors ?? DEFAULT_BRAND_COLORS
  }
  // Org branding: prefer live org profile, then colors copied onto the event at save time
  // (logo uses the same snapshot pattern because anon live pages cannot read organizations).
  return orgColors ?? eventColors ?? DEFAULT_BRAND_COLORS
}

export function logoForEvent(
  event: Tables<'events'>,
  org: TenantPublicOrg | Tables<'organizations'> | null,
  tone?: DisplayTextColor,
): string | null {
  if (event.branding_enabled && event.logo_url) return event.logo_url
  if (org) {
    // Item 7: pick the client logo that contrasts with the surface. Black text
    // = light background → dark logo; white text = dark background → light logo.
    const themed = tone === 'black' ? org.logo_dark_url : tone === 'white' ? org.logo_light_url : null
    if (themed) return themed
  }
  return org?.logo_url ?? event.logo_url ?? null
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
  return event.status === 'active' || event.status === 'demo'
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

/**
 * The event clock on player devices: always H:MM:SS (a two-hour event shows
 * 2:00:00, not 120:00, which read as a broken minutes counter on devices).
 */
export function formatClockTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Break / stage timers: always M:SS (e.g. 5:00 for five minutes). */
export function formatBreakTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function breakDurationSeconds(
  stage: { durationMinutes?: number; durationSeconds?: number } | null,
  storedSeconds: number | null | undefined,
): number {
  if (storedSeconds != null && storedSeconds >= 60) return storedSeconds
  // Stages authored before the seconds field simply have no durationSeconds,
  // so they keep resolving to whole minutes exactly as before.
  const minutes = stage?.durationMinutes ?? 5
  const seconds = stage?.durationSeconds ?? 0
  return minutes * 60 + seconds
}

export function quizQuestions(game: Tables<'games'>): QuizQuestion[] {
  const config = (game.config ?? {}) as GameConfig
  const questions = (config.questions ?? []).filter(
    (q): q is QuizQuestion => Boolean(q?.id && q?.text),
  )
  if (!config.rounds_enabled || !config.rounds?.length) return questions

  const byId = new Map(questions.map((q) => [q.id, q]))
  const ordered: QuizQuestion[] = []
  const seen = new Set<string>()
  for (const round of config.rounds) {
    for (const qid of round.questionIds) {
      const q = byId.get(qid)
      if (q && !seen.has(q.id)) {
        ordered.push(q)
        seen.add(q.id)
      }
    }
  }
  for (const q of questions) {
    if (!seen.has(q.id)) ordered.push(q)
  }
  return ordered
}

export function bingoTracks(game: Tables<'games'>): MusicTrack[] {
  return musicTracksFromGameConfig(game.config)
}

export type { BingoCell } from '@/lib/bingo-engine'
export { bingoCellLabels, trackForPlayIndex } from '@/lib/bingo-engine'

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

export const PARTICIPANT_TEAM_KEY = 'rallyhub_team_id'

export function getMaxVideoDurationSeconds(config: GameConfig | null | undefined): number {
  const max = config?.max_video_duration_seconds
  if (max != null && max > 0) return max
  return 120
}

export function formatVideoDurationLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m > 0 && sec > 0) return `${m} min ${sec} sec`
  if (m > 0) return `${m} min`
  return `${sec} sec`
}

export function quizSubmissionMediaType(questionId: string): string {
  return `quiz:${questionId}`
}

export function isQuizSubmission(mediaType: string | null | undefined): boolean {
  return mediaType === 'quiz' || Boolean(mediaType?.startsWith('quiz:'))
}

/** Latest non-cancelled submission for open-game flow (pending / approved / rejected). */
export function activeSubmissionForGame(
  subs: Tables<'submissions'>[],
  gameId: string,
): Tables<'submissions'> | undefined {
  return subs
    .filter((s) => s.game_id === gameId && s.status !== 'cancelled')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

export type QuizLeaderboardEntry = {
  team: Tables<'teams'>
  quizPoints: number
}

export async function scoreCurrentQuizQuestion(
  eventId: string,
  quizGame: Tables<'games'>,
  question: QuizQuestion,
): Promise<void> {
  const { error } = await supabase.rpc('score_current_quiz_question', {
    p_event_id: eventId,
    p_game_id: quizGame.id,
    p_question_id: question.id,
  })
  if (error) throw error
  await publishLiveBundleReload(eventId)
}

/**
 * Reveal the current quiz question server-side. The facilitator's bundle has
 * correctAnswerId redacted (get_live_event_games redacts for everyone), so the
 * id MUST come from the DB — this RPC reads the unredacted answer and writes
 * quiz_state='revealed' + quiz_correct_answer_id atomically.
 */
export async function revealQuizAnswer(
  eventId: string,
  gameId: string,
  questionId: string,
): Promise<void> {
  const { error } = await supabase.rpc('reveal_quiz_answer', {
    p_event_id: eventId,
    p_game_id: gameId,
    p_question_id: questionId,
  })
  if (error) throw error
  await publishLiveBundleReload(eventId)
}

export function quizLeaderboard(
  teams: Tables<'teams'>[],
  submissions: Tables<'submissions'>[],
  gameId: string,
): QuizLeaderboardEntry[] {
  const pointsByTeam = new Map<string, number>()
  for (const s of submissions) {
    if (s.game_id !== gameId || !isQuizSubmission(s.media_type)) continue
    const pts = s.points_awarded ?? 0
    if (pts <= 0) continue
    pointsByTeam.set(s.team_id, (pointsByTeam.get(s.team_id) ?? 0) + pts)
  }
  return teams
    .filter((t) => t.name?.trim())
    .map((team) => ({
      team,
      quizPoints: pointsByTeam.get(team.id) ?? 0,
    }))
    .sort((a, b) => b.quizPoints - a.quizPoints)
}
