import { ensureLiveEventAccess } from '@/lib/live-event-access'
import { generateBingoRun } from '@/lib/bingo-engine'
import type { BingoCell } from '@/lib/bingo-engine'
import { normalizeBingoPlayOrder } from '@/lib/bingo-run-cache'
import {
  bingoRunRowToBroadcast,
  publishLiveBundlePatch,
} from '@/lib/live-broadcast'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

export type ActivateBingoRunResult = {
  runId: string
  playOrder: string[]
  currentPlayIndex: number
  alreadyActive: boolean
}

/**
 * Activate a bingo run via Edge Function (authenticated facilitator) or,
 * when the edge call fails, via direct client inserts as the logged-in facilitator.
 */
export async function activateBingoRun(
  eventId: string,
  gameId: string,
  stageIndex: number,
): Promise<ActivateBingoRunResult> {
  try {
    const { data, error } = await supabase.functions.invoke('activate-bingo-run', {
      body: { eventId, gameId, stageIndex },
    })
    if (error) throw error
    const body = data as { error?: string } & ActivateBingoRunResult
    if (body.error) throw new Error(body.error)
    await publishBingoActivationBroadcasts(eventId, gameId, stageIndex, body)
    return body
  } catch {
    return activateBingoRunLocal(eventId, gameId, stageIndex)
  }
}

async function publishBingoActivationBroadcasts(
  eventId: string,
  _gameId: string,
  stageIndex: number,
  result: ActivateBingoRunResult,
): Promise<void> {
  const { data: runRow } = await supabase
    .from('bingo_runs')
    .select('*')
    .eq('id', result.runId)
    .maybeSingle()

  if (runRow) {
    await publishLiveBundlePatch(eventId, {
      kind: 'bingo_run',
      eventId,
      stageIndex,
      row: bingoRunRowToBroadcast({
        ...runRow,
        play_order: (runRow.play_order as string[]) ?? [],
      }),
    })
  }

  const { data: cards } = await supabase
    .from('bingo_team_cards')
    .select('run_id, team_id, cells')
    .eq('run_id', result.runId)

  for (const card of cards ?? []) {
    await publishLiveBundlePatch(eventId, {
      kind: 'bingo_team_card',
      runId: card.run_id,
      teamId: card.team_id,
      cells: card.cells as BingoCell[],
    })
  }

  if (!result.alreadyActive) {
    const { data: stateRow } = await supabase
      .from('event_state')
      .select('*')
      .eq('event_id', eventId)
      .single()
    if (stateRow) {
      await publishLiveBundlePatch(eventId, { kind: 'event_state', row: stateRow })
    }
  }
}

async function activateBingoRunLocal(
  eventId: string,
  gameId: string,
  stageIndex: number,
): Promise<ActivateBingoRunResult> {
  await ensureLiveEventAccess(eventId)

  const { data: existing } = await supabase
    .from('bingo_runs')
    .select('id, play_order, current_play_index')
    .eq('event_id', eventId)
    .eq('stage_index', stageIndex)
    .maybeSingle()

  if (existing) {
    const result = {
      runId: existing.id,
      playOrder: normalizeBingoPlayOrder(existing.play_order),
      currentPlayIndex: existing.current_play_index,
      alreadyActive: true,
    }
    await publishLiveBundlePatch(eventId, {
      kind: 'bingo_run',
      eventId,
      stageIndex,
      row: bingoRunRowToBroadcast({
        id: existing.id,
        event_id: eventId,
        game_id: gameId,
        stage_index: stageIndex,
        play_order: result.playOrder,
        current_play_index: result.currentPlayIndex,
        status: 'active',
      }),
    })
    return result
  }

  const [{ data: teams }, { data: games }] = await Promise.all([
    supabase.from('teams').select('id, name').eq('event_id', eventId).order('slot_number'),
    supabase.rpc('get_live_event_games', { p_event_id: eventId }),
  ])

  const game = ((games ?? []) as { id: string; config: unknown }[]).find((g) => g.id === gameId)
  const config = (game?.config ?? {}) as GameConfig
  const tracks = (config.tracks ?? []).filter((t) => t.id && t.title)
  if (tracks.length < 5) throw new Error('Game needs at least 5 tracks')

  const activationSeed = `${eventId}:${stageIndex}:${crypto.randomUUID()}`
  const plan = generateBingoRun({
    tracks,
    teams: teams ?? [],
    gameId,
    activationSeed,
  })

  const { data: run, error: runErr } = await supabase
    .from('bingo_runs')
    .insert({
      event_id: eventId,
      game_id: gameId,
      stage_index: stageIndex,
      play_order: plan.playOrder,
      current_play_index: 0,
      status: 'active',
    })
    .select('id, play_order, current_play_index')
    .single()

  if (runErr) throw runErr

  const cardRows = Object.entries(plan.cardsByTeamId).map(([teamId, cells]) => ({
    run_id: run.id,
    team_id: teamId,
    cells,
  }))
  const { error: cardsErr } = await supabase.from('bingo_team_cards').insert(cardRows)
  if (cardsErr) throw cardsErr

  // P2.2 hardening: a Start press racing this activation may already have
  // begun playback and written bingo_state='playing'. That clip is the round
  // the room is hearing, so never reset a playing row back to 'waiting'. The
  // guard lives in the UPDATE itself (conditional write, zero rows matched
  // when playing), not a read-then-write that could race.
  await supabase
    .from('event_state')
    .update({
      current_question_index: 0,
      bingo_state: 'waiting',
      bingo_revealed_track_ids: [],
      bingo_winner_team_id: null,
      bingo_announced_winner_ids: [],
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .neq('bingo_state', 'playing')

  const { data: stateRow } = await supabase
    .from('event_state')
    .select('*')
    .eq('event_id', eventId)
    .single()

  if (stateRow) {
    await publishLiveBundlePatch(eventId, { kind: 'event_state', row: stateRow })
  }

  const runBroadcast = bingoRunRowToBroadcast({
    id: run.id,
    event_id: eventId,
    game_id: gameId,
    stage_index: stageIndex,
    play_order: plan.playOrder,
    current_play_index: 0,
    status: 'active',
  })
  await publishLiveBundlePatch(eventId, {
    kind: 'bingo_run',
    eventId,
    stageIndex,
    row: runBroadcast,
  })

  for (const [teamId, cells] of Object.entries(plan.cardsByTeamId)) {
    await publishLiveBundlePatch(eventId, {
      kind: 'bingo_team_card',
      runId: run.id,
      teamId,
      cells,
    })
  }

  return {
    runId: run.id,
    playOrder: plan.playOrder,
    currentPlayIndex: 0,
    alreadyActive: false,
  }
}
