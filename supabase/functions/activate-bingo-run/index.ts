import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateBingoRun } from '../_shared/bingo-engine.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type GameConfig = { tracks?: { id: string; title: string; artist: string }[] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { eventId, gameId, stageIndex } = await req.json()
    if (!eventId || !gameId || stageIndex == null) {
      return new Response(JSON.stringify({ error: 'eventId, gameId, stageIndex required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: existing } = await supabase
      .from('bingo_runs')
      .select('id, play_order, current_play_index')
      .eq('event_id', eventId)
      .eq('stage_index', stageIndex)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({
          runId: existing.id,
          playOrder: existing.play_order,
          currentPlayIndex: existing.current_play_index,
          alreadyActive: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const [{ data: teams }, { data: game }] = await Promise.all([
      supabase.from('teams').select('id, name').eq('event_id', eventId).order('slot_number'),
      supabase.from('games').select('config').eq('id', gameId).maybeSingle(),
    ])

    const config = (game?.config ?? {}) as GameConfig
    const tracks = (config.tracks ?? []).filter((t) => t.id && t.title)
    if (tracks.length < 5) {
      return new Response(JSON.stringify({ error: 'Game needs at least 5 tracks' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const activationSeed = `${eventId}:${stageIndex}:${crypto.randomUUID()}`
    const plan = generateBingoRun({
      tracks,
      teams: teams ?? [],
      activationSeed,
      targetPlayCount: Math.min(32, Math.max(25, tracks.length)),
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
      .select('id')
      .single()

    if (runErr) throw runErr

    const { error: secretErr } = await supabase.from('bingo_run_secrets').insert({
      run_id: run.id,
      winner_team_id: plan.winnerTeamId,
    })
    if (secretErr) throw secretErr

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
        bingo_state: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)

    return new Response(
      JSON.stringify({
        runId: run.id,
        playOrder: plan.playOrder,
        currentPlayIndex: 0,
        alreadyActive: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'activate-bingo-run failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
