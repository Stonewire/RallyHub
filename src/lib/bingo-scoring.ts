import { applySubmissionPoints } from '@/lib/apply-submission-points'
import type { BingoCell } from '@/lib/bingo-engine'
import {
  approvedBingoCellIndices,
  hasConfiguredBingoLine,
} from '@/lib/bingo-lines'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

export type ScoreBingoRoundResult = {
  correctIndex: number
  trackId: string
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
  const winningLines = gameConfig.bingo_winning_lines ?? []

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

  const firstCard = cards?.[0]?.cells as BingoCell[] | undefined
  const correctIndex = firstCard?.findIndex((c) => c.trackId === trackId) ?? -1

  if (!cards?.length || correctIndex < 0) {
    return { correctIndex, trackId }
  }

  const approveUpdates: { id: string; teamId: string; points: number }[] = []
  const rejectIds: string[] = []
  const teamScoreDeltas = new Map<string, number>()
  const lineAwarded = new Set<string>()

  for (const row of cards) {
    const cells = row.cells as BingoCell[]
    const rowCorrectIndex = cells.findIndex((c) => c.trackId === trackId)
    const teamSubs = (subs ?? []).filter((s) => s.team_id === row.team_id)

    for (const sub of teamSubs) {
      const markedIndex = Number(sub.media_url)
      if (Number.isNaN(markedIndex)) continue

      if (markedIndex === rowCorrectIndex) {
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

  await Promise.all([
    ...approveUpdates.map(({ id, points }) =>
      supabase
        .from('submissions')
        .update({ status: 'approved', points_awarded: points })
        .eq('id', id),
    ),
    rejectIds.length > 0
      ? supabase.from('submissions').update({ status: 'rejected' }).in('id', rejectIds)
      : Promise.resolve(),
  ])

  for (const [teamId, delta] of teamScoreDeltas) {
    await applySubmissionPoints(teamId, delta)
  }

  if (linePoints > 0 && winningLines.length > 0) {
    const { data: allSubs } = await supabase
      .from('submissions')
      .select('team_id, media_url, status, game_id, media_type')
      .eq('event_id', eventId)
      .eq('game_id', gameId)
      .eq('media_type', 'bingo')

    for (const row of cards) {
      const teamSubs = (allSubs ?? []).filter((s) => s.team_id === row.team_id)
      const approved = approvedBingoCellIndices(teamSubs, gameId)
      if (!hasConfiguredBingoLine(approved, winningLines)) continue
      if (lineAwarded.has(row.team_id)) continue
      lineAwarded.add(row.team_id)
      await applySubmissionPoints(row.team_id, linePoints)
    }
  }

  return { correctIndex, trackId }
}
