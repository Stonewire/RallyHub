import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { eventId, stageIndex } = await req.json()
    if (!eventId || stageIndex == null) {
      return new Response(JSON.stringify({ error: 'eventId and stageIndex required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: run, error: runErr } = await supabase
      .from('bingo_runs')
      .select('id, game_id, status')
      .eq('event_id', eventId)
      .eq('stage_index', stageIndex)
      .maybeSingle()

    if (runErr) throw runErr
    if (!run) {
      return new Response(JSON.stringify({ error: 'No bingo run for this stage' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: secret, error: secretErr } = await supabase
      .from('bingo_run_secrets')
      .select('winner_team_id')
      .eq('run_id', run.id)
      .maybeSingle()

    if (secretErr) throw secretErr
    if (!secret) {
      return new Response(JSON.stringify({ error: 'Winner not set for this run' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: team }, { data: game }] = await Promise.all([
      supabase.from('teams').select('id, name, score').eq('id', secret.winner_team_id).maybeSingle(),
      supabase.from('games').select('points_type, points_static, points_min, points_max').eq('id', run.game_id).maybeSingle(),
    ])

    if (!team) {
      return new Response(JSON.stringify({ error: 'Winner team not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let points = game?.points_static ?? 10
    if (game?.points_type === 'range') {
      points = game.points_max ?? game.points_min ?? 10
    }

    const newScore = (team.score ?? 0) + points
    await supabase.from('teams').update({ score: newScore }).eq('id', team.id)

    if (run.status !== 'completed') {
      await supabase.from('bingo_runs').update({ status: 'completed' }).eq('id', run.id)
    }

    return new Response(
      JSON.stringify({
        winnerName: team.name ?? 'Winner',
        pointsAwarded: points,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reveal-bingo-winner failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
