/**
 * Pure helpers for the audience display's bingo view (P2.5).
 *
 * The display derives everything read-only from data it already receives:
 * cell marks are `submissions` rows (media_type 'bingo', status 'pending'
 * while a round is open), and `scoreBingoRound` flips those same rows to
 * 'approved' or 'rejected' at the reveal. No new broadcast kinds, no writes.
 */
import type { Tables } from '@/types/helpers'

export type BingoTeamGuessState = 'neutral' | 'marked' | 'correct' | 'wrong'

export type BingoMarkSubmission = Pick<
  Tables<'submissions'>,
  'id' | 'team_id' | 'game_id' | 'media_type' | 'media_url' | 'status' | 'created_at'
>

/** True for a real bingo cell mark: claim placeholders and blank rows excluded. */
function isBingoCellMark(sub: BingoMarkSubmission, gameId: string): boolean {
  return (
    sub.media_type === 'bingo' &&
    sub.game_id === gameId &&
    sub.media_url != null &&
    sub.media_url !== 'claim'
  )
}

/**
 * Latest pending cell mark per team for the open round. Pending bingo marks
 * only ever exist for the round currently playing (scoring flips them and the
 * advance clears leftovers), so this is the per-team "has marked" signal.
 */
export function pendingBingoMarkIdsByTeam(
  submissions: readonly BingoMarkSubmission[],
  gameId: string,
): Map<string, string> {
  const latestByTeam = new Map<string, BingoMarkSubmission>()
  for (const sub of submissions) {
    if (sub.status !== 'pending' || !isBingoCellMark(sub, gameId)) continue
    const prev = latestByTeam.get(sub.team_id)
    if (!prev || sub.created_at > prev.created_at) latestByTeam.set(sub.team_id, sub)
  }
  const ids = new Map<string, string>()
  for (const [teamId, sub] of latestByTeam) ids.set(teamId, sub.id)
  return ids
}

/** Shallow equality for the remembered mark maps, so effects can skip no-op updates. */
export function markMapsEqual(
  a: ReadonlyMap<string, string>,
  b: ReadonlyMap<string, string>,
): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/**
 * Per-team guess indicator for the current round.
 *
 * While guessing is open ('playing') a team lights up as soon as it has a
 * pending mark. At the reveal ('revealed') the remembered pending rows are
 * looked up again: approved means correct, rejected means wrong, a deleted or
 * missing row (team withdrew its mark) stays neutral, and a row still pending
 * (status patch not landed yet) keeps the team-colour light rather than
 * flashing grey. Every other bingo state is neutral.
 */
export function bingoTeamGuessStates(params: {
  bingoState: string
  teamIds: readonly string[]
  submissions: readonly BingoMarkSubmission[]
  gameId: string | null
  rememberedMarkIdByTeam: ReadonlyMap<string, string>
}): Map<string, BingoTeamGuessState> {
  const { bingoState, teamIds, submissions, gameId, rememberedMarkIdByTeam } = params
  const states = new Map<string, BingoTeamGuessState>()
  for (const id of teamIds) states.set(id, 'neutral')
  if (!gameId) return states

  if (bingoState === 'playing') {
    const pending = pendingBingoMarkIdsByTeam(submissions, gameId)
    for (const teamId of pending.keys()) {
      if (states.has(teamId)) states.set(teamId, 'marked')
    }
    return states
  }

  if (bingoState === 'revealed') {
    const byId = new Map(submissions.map((s) => [s.id, s]))
    for (const [teamId, subId] of rememberedMarkIdByTeam) {
      if (!states.has(teamId)) continue
      const sub = byId.get(subId)
      if (!sub) continue
      if (sub.status === 'approved') states.set(teamId, 'correct')
      else if (sub.status === 'rejected') states.set(teamId, 'wrong')
      else if (sub.status === 'pending') states.set(teamId, 'marked')
    }
    return states
  }

  return states
}

/** Compact circle label: initials of the first two words, or two letters of one. */
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  // Code-point slicing so emoji and other astral characters never split into
  // broken surrogate halves on the big screen.
  if (words.length === 1) return [...words[0]].slice(0, 2).join('').toUpperCase()
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase()
}

export type BingoVisualizerBar = {
  durationMs: number
  delayMs: number
  min: number
  max: number
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

/**
 * Deterministic bar parameters for the pseudo-waveform, seeded per song so
 * every round gets its own shape (same LCG family as bingo-engine). Purely
 * cosmetic: the display never analyses real audio.
 */
export function bingoVisualizerBars(seed: string, count: number): BingoVisualizerBar[] {
  let s = hashSeed(seed)
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const bars: BingoVisualizerBar[] = []
  for (let i = 0; i < count; i++) {
    const min = 0.1 + next() * 0.2
    const max = Math.min(1, min + 0.35 + next() * 0.55)
    bars.push({
      durationMs: Math.round(650 + next() * 850),
      delayMs: Math.round(next() * 1400),
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
    })
  }
  return bars
}
