import { applySubmissionPoints } from '@/lib/apply-submission-points'
import { resolveBingoSubmissionTrackId } from '@/lib/bingo-cell-match'
import type { BingoCell } from '@/lib/bingo-engine'
import {
  approvedBingoCellIndices,
  bingoWinAchieved,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

export type ScoreBingoRoundResult = {
  correctIndex: number
  trackId: string
  winningTeamIds: string[]
}

/** Approve/reject pending cell marks for the track that was just played. */
export async function scoreBingoRound(params: {
  eventId: string
  gameId: string
  runId: string
  trackId: string
  gameConfig: GameConfig
}): Promise<ScoreBingoRoundResult> {
  const { eventId, gameId, runId, trackId, gameConfig } = params
  const pointsPerCorrect = gameConfig.bingo_points_per_correct ?? 10
  const linePoints = gameConfig.bingo_line_points ?? 0
  const winConfig = resolveBingoWinConfig(gameConfig)

  const [{ data: cards }, { data: subs }] = await Promise.all([
    supabase.from('bingo_team_cards').select('team_id, cells').eq('run_id', runId),
    supabase
      .from('submissions')
      .select('id, team_id, media_url, status')
      .eq('event_id', eventId)
      .eq('game_id', gameId)
      .eq('media_type', 'bingo')
      .eq('status', 'pending'),
  ])

  if (!cards?.length) {
    return { correctIndex: -1, trackId, winningTeamIds: [] }
  }

  // Index of the played track on the first card (informational only). Each team
  // card is a random subset, so this may be -1 even when other teams have the
  // track — scoring below matches every team's submission by trackId regardless.
  const firstCard = cards[0]?.cells as BingoCell[] | undefined
  const correctIndex = firstCard?.findIndex((c) => c.trackId === trackId) ?? -1

  const approveUpdates: { id: string; teamId: string; points: number }[] = []
  const rejectIds: string[] = []
  const teamScoreDeltas = new Map<string, number>()
  const lineAwarded = new Set<string>()

  for (const row of cards) {
    const cells = row.cells as BingoCell[]
    const teamSubs = (subs ?? []).filter((s) => s.team_id === row.team_id)

    for (const sub of teamSubs) {
      if (sub.media_url == null) continue
      const markedTrackId = resolveBingoSubmissionTrackId(sub.media_url, cells)
      if (!markedTrackId) continue

      if (markedTrackId === trackId) {
        approveUpdates.push({ id: sub.id, teamId: row.team_id, points: pointsPerCorrect })
        teamScoreDeltas.set(
          row.team_id,
          (teamScoreDeltas.get(row.team_id) ?? 0) + pointsPerCorrect,
        )
      } else {
        rejectIds.push(sub.id)
      }
    }
  }

  const approveResults = await Promise.all(
    approveUpdates.map(({ id, points }) =>
      supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: points })
        .eq('id', id),
    ),
  )
  const rejectResult =
    rejectIds.length > 0
      ? await supabase.from('submissions').update({ status: 'rejected' }).in('id', rejectIds)
      : null

  const approveErrors = approveResults.filter((r) => r.error).map((r) => r.error)
  if (approveErrors.length > 0) {
    console.error('Failed to approve bingo submissions', approveErrors)
  }
  if (rejectResult?.error) {
    console.error('Failed to reject bingo submissions', rejectResult.error)
  }

  for (const [teamId, delta] of teamScoreDeltas) {
    await applySubmissionPoints(teamId, delta)
  }

  // Win detection runs every round on the team's FULL set of approved cells
  // (all rounds, not just this one) and is independent of line points — the
  // celebration must fire on a completed win even when no points are configured.
  const winningTeamIds: string[] = []
  const { data: allSubs } = await supabase
    .from('submissions')
    .select('team_id, media_url, status, game_id, media_type')
    .eq('event_id', eventId)
    .eq('game_id', gameId)
    .eq('media_type', 'bingo')

  for (const row of cards) {
    const teamSubs = (allSubs ?? []).filter((s) => s.team_id === row.team_id)
    const teamCells = row.cells as BingoCell[]
    const approved = approvedBingoCellIndices(teamSubs, gameId, teamCells)
    const achieved = bingoWinAchieved(approved, winConfig)
    if (!achieved) continue
    if (lineAwarded.has(row.team_id)) continue
    lineAwarded.add(row.team_id)
    winningTeamIds.push(row.team_id)
    if (linePoints > 0) await applySubmissionPoints(row.team_id, linePoints)
  }

  return { correctIndex, trackId, winningTeamIds }
}
