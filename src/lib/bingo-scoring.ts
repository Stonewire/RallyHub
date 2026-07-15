import { applySubmissionPoints } from '@/lib/apply-submission-points'
import { resolveBingoSubmissionTrackId } from '@/lib/bingo-cell-match'
import type { BingoCell } from '@/lib/bingo-engine'
import {
  approvedBingoCellIndices,
  bingoWinAchieved,
  resolveBingoWinConfig,
} from '@/lib/bingo-lines'
import { publishLiveBundlePatch, publishLiveBundleReload } from '@/lib/live-broadcast'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

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
  // Default must match the editor's displayed default (BingoWinningComboEditor
  // shows `?? 100`). Games saved without touching the field have no
  // bingo_line_points key, so a `?? 0` here silently paid nothing.
  const linePoints = gameConfig.bingo_line_points ?? 100
  const winConfig = resolveBingoWinConfig(gameConfig)

  const [{ data: cards }, { data: subs }, { data: runRow }] = await Promise.all([
    supabase.from('bingo_team_cards').select('team_id, cells').eq('run_id', runId),
    supabase
      .from('submissions')
      .select('id, team_id, media_url, status')
      .eq('event_id', eventId)
      .eq('game_id', gameId)
      .eq('media_type', 'bingo')
      .eq('status', 'pending'),
    supabase.from('bingo_runs').select('paid_line_bonus_team_ids').eq('id', runId).single(),
  ])

  const paidLineBonusTeamIds = new Set<string>(
    Array.isArray(runRow?.paid_line_bonus_team_ids)
      ? (runRow.paid_line_bonus_team_ids as string[])
      : [],
  )

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
  const newlyPaidLineBonusTeamIds: string[] = []

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

  // Every correct mark in this round earns the same value, so one filtered
  // UPDATE replaces a network request per team. `.select()` returns the rows
  // that actually changed, which remains the source of truth for score deltas.
  const approveIds = approveUpdates.map((row) => row.id)
  const approveResult =
    approveIds.length > 0
      ? await supabase
          .from('submissions')
          .update({ status: 'approved', points_awarded: pointsPerCorrect })
          .in('id', approveIds)
          .select()
      : null
  const rejectResult =
    rejectIds.length > 0
      ? await supabase
          .from('submissions')
          .update({ status: 'rejected' })
          .in('id', rejectIds)
          .select()
      : null

  const approveById = new Map(approveUpdates.map((row) => [row.id, row]))
  const confirmedDeltas = new Map<string, number>()
  for (const row of approveResult?.data ?? []) {
    const approved = approveById.get(row.id)
    if (!approved) continue
    confirmedDeltas.set(
      approved.teamId,
      (confirmedDeltas.get(approved.teamId) ?? 0) + approved.points,
    )
  }

  await Promise.all(
    [...confirmedDeltas].map(([teamId, delta]) =>
      applySubmissionPoints(teamId, delta, eventId),
    ),
  )

  if (approveResult?.error || rejectResult?.error) {
    const msgs = [
      ...(approveResult?.error ? [approveResult.error.message] : []),
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

  for (const row of cards) {
    const teamSubs = (allSubs ?? []).filter((s) => s.team_id === row.team_id)
    const teamCells = row.cells as BingoCell[]
    const approved = approvedBingoCellIndices(teamSubs, gameId, teamCells)
    const achieved = bingoWinAchieved(approved, winConfig)
    if (!achieved) continue
    winningTeamIds.push(row.team_id)
    const lineBonusAlreadyPaid = paidLineBonusTeamIds.has(row.team_id)
    if (linePoints > 0 && !lineBonusAlreadyPaid) {
      await applySubmissionPoints(row.team_id, linePoints, eventId)
      paidLineBonusTeamIds.add(row.team_id)
      newlyPaidLineBonusTeamIds.push(row.team_id)
    }
  }

  if (newlyPaidLineBonusTeamIds.length > 0) {
    const { error: paidErr } = await supabase
      .from('bingo_runs')
      .update({ paid_line_bonus_team_ids: [...paidLineBonusTeamIds] })
      .eq('id', runId)
    if (paidErr) {
      console.error('Failed to persist paid line bonus team ids', paidErr)
    }
  }

  // Push approved/rejected marks to players as targeted patches so cells turn
  // green/red instantly, in step with the winner reveal, instead of waiting for
  // the full-bundle reload below. Team scores already broadcast via
  // incrementTeamScore; the full reload stays as a consistency safety net.
  const markPatches: Tables<'submissions'>[] = [
    ...((approveResult?.data as Tables<'submissions'>[] | null | undefined) ?? []),
    ...((rejectResult?.data as Tables<'submissions'>[] | null | undefined) ?? []),
  ]
  void Promise.all(
    markPatches.map((row) =>
      publishLiveBundlePatch(eventId, { kind: 'submission', op: 'UPDATE', row }),
    ),
  )
    .then(() => publishLiveBundleReload(eventId))
    .catch(() => {
      // Best-effort fan-out; the DB is authoritative and fallback polling/reload
      // will reconcile clients after a transient Realtime failure.
    })

  return { correctIndex, trackId, winningTeamIds }
}
