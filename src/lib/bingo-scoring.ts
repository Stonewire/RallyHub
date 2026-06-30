import { applySubmissionPoints } from '@/lib/apply-submission-points'
import { resolveBingoSubmissionTrackId } from '@/lib/bingo-cell-match'
import type { BingoCell } from '@/lib/bingo-engine'
import {
  approvedBingoCellIndices,
  bingoWinAchieved,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'
import { publishLiveBundleReload } from '@/lib/live-broadcast'
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
    approveUpdates.map(({ id, teamId, points }) =>
      supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: points })
        .eq('id', id)
        .then((r) => ({ ...r, teamId, points })),
    ),
  )
  const rejectResult =
    rejectIds.length > 0
      ? await supabase.from('submissions').update({ status: 'rejected' }).in('id', rejectIds)
      : null

  const approveErrors = approveResults.filter((r) => r.error)
  const confirmedDeltas = new Map<string, number>()
  for (const r of approveResults) {
    if (!r.error) {
      confirmedDeltas.set(r.teamId, (confirmedDeltas.get(r.teamId) ?? 0) + r.points)
    }
  }

  for (const [teamId, delta] of confirmedDeltas) {
    await applySubmissionPoints(teamId, delta, eventId)
  }

  if (approveErrors.length > 0 || rejectResult?.error) {
    const msgs = [
      ...approveErrors.map((r) => r.error?.message ?? 'approve failed'),
      ...(rejectResult?.error ? [rejectResult.error.message] : []),
    ]
    throw new Error(`Bingo scoring DB errors: ${msgs.join('; ')}`)
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

  const lineBonusErrors: string[] = []
  for (const row of cards) {
    const teamSubs = (allSubs ?? []).filter((s) => s.team_id === row.team_id)
    const teamCells = row.cells as BingoCell[]
    const approved = approvedBingoCellIndices(teamSubs, gameId, teamCells)
    const achieved = bingoWinAchieved(approved, winConfig)
    if (!achieved) continue
    winningTeamIds.push(row.team_id)
    if (linePoints > 0) {
      // Atomic claim+pay: the RPC awards the bonus once per (run, team) under a
      // row lock, so concurrent score calls can no longer double-pay it.
      const { error: bonusErr } = await supabase.rpc('award_bingo_line_bonus', {
        p_run_id: runId,
        p_team_id: row.team_id,
        p_points: linePoints,
      })
      if (bonusErr) lineBonusErrors.push(bonusErr.message)
    }
  }

  await publishLiveBundleReload(eventId)

  if (lineBonusErrors.length > 0) {
    throw new Error(`Bingo line bonus DB errors: ${lineBonusErrors.join('; ')}`)
  }

  return { correctIndex, trackId, winningTeamIds }
}
