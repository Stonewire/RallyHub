import { generateBingoRun } from '@/lib/bingo-engine'
import { supabase } from '@/lib/supabase'
import type { GameConfig } from '@/types/game-config'

export type ActivateBingoRunResult = {
  runId: string
  playOrder: string[]
  currentPlayIndex: number
  alreadyActive: boolean
}

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
    return body
  } catch {
    return activateBingoRunLocal(eventId, gameId, stageIndex)
  }
}

async function activateBingoRunLocal(
  eventId: string,
  gameId: string,
  stageIndex: number,
): Promise<ActivateBingoRunResult> {
  const { data: existing } = await supabase
    .from('bingo_runs')
    .select('id, play_order, current_play_index')
    .eq('event_id', eventId)
    .eq('stage_index', stageIndex)
    .maybeSingle()

  if (existing) {
    return {
      runId: existing.id,
      playOrder: (existing.play_order as string[]) ?? [],
      currentPlayIndex: existing.current_play_index,
      alreadyActive: true,
    }
  }

  const [{ data: teams }, { data: game }] = await Promise.all([
    supabase.from('teams').select('id, name').eq('event_id', eventId).order('slot_number'),
    supabase.from('games').select('config').eq('id', gameId).maybeSingle(),
  ])

  const config = (game?.config ?? {}) as GameConfig
  const tracks = (config.tracks ?? []).filter((t) => t.id && t.title)
  if (tracks.length < 5) throw new Error('Game needs at least 5 tracks')

  const activationSeed = `${eventId}:${stageIndex}:${crypto.randomUUID()}`
  const plan = generateBingoRun({
    tracks,
    teams: teams ?? [],
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

  await supabase
    .from('event_state')
    .update({
      current_question_index: 0,
      bingo_state: 'waiting',
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)

  return {
    runId: run.id,
    playOrder: plan.playOrder,
    currentPlayIndex: 0,
    alreadyActive: false,
  }
}
