/**
 * Creates/removes an isolated production-Supabase bingo event for browser smoke tests.
 *
 * Usage:
 *   node scripts/bingo-smoke-fixture.mjs setup
 *   node scripts/bingo-smoke-fixture.mjs reset <event-id>
 *   node scripts/bingo-smoke-fixture.mjs inspect <event-id>
 *   node scripts/bingo-smoke-fixture.mjs prepare-winner <event-id> <team-id>
 *   node scripts/bingo-smoke-fixture.mjs announce-winner <event-id> <team-id>
 *   node scripts/bingo-smoke-fixture.mjs cleanup
 *
 * Setup clones branding + the real bingo game from the dedicated "Test" demo,
 * creates two empty team slots, cards/run/state, and a temporary facilitator.
 * Cleanup removes every event/user with the CODEX smoke-test prefix.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EVENT_PREFIX = 'CODEX BINGO SMOKE'
const EMAIL_PREFIX = 'codex-bingo-smoke-'
const SOURCE_EVENT_ID = 'fd7ebcf6-d9bb-45f8-bce2-bb49fd129abd'
const SOURCE_GAME_ID = 'eea1fc93-5fc5-4aad-a2e6-81003f3e73b0'

function loadEnv() {
  const path = resolve(root, '.env')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 1) continue
    out[trimmed.slice(0, i).trim()] = trimmed
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return out
}

const env = { ...loadEnv(), ...process.env }
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase URL/service role key')
}

const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function cleanup() {
  const { data: events, error: eventReadError } = await admin
    .from('events')
    .select('id,name')
    .like('name', `${EVENT_PREFIX}%`)
  if (eventReadError) throw eventReadError
  if (events?.length) {
    const { error } = await admin
      .from('events')
      .delete()
      .in('id', events.map((event) => event.id))
    if (error) throw error
  }

  const { data: users, error: userReadError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (userReadError) throw userReadError
  const smokeUsers = users.users.filter((user) =>
    user.email?.startsWith(EMAIL_PREFIX),
  )
  for (const user of smokeUsers) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
  }

  console.log(
    JSON.stringify({ removedEvents: events?.length ?? 0, removedUsers: smokeUsers.length }),
  )
}

async function setup() {
  await cleanup()

  const [{ data: sourceEvent, error: eventError }, { data: game, error: gameError }] =
    await Promise.all([
      admin.from('events').select('*').eq('id', SOURCE_EVENT_ID).single(),
      admin.from('games').select('*').eq('id', SOURCE_GAME_ID).single(),
    ])
  if (eventError) throw eventError
  if (gameError) throw gameError

  const tracks = Array.isArray(game.config?.tracks) ? game.config.tracks : []
  if (tracks.length < 25) throw new Error('Smoke game needs at least 25 tracks')

  const stamp = Date.now()
  const eventName = `${EVENT_PREFIX} ${stamp}`
  const { data: event, error: createEventError } = await admin
    .from('events')
    .insert({
      organization_id: sourceEvent.organization_id,
      name: eventName,
      status: 'demo',
      team_count: 2,
      branding_enabled: sourceEvent.branding_enabled,
      logo_url: sourceEvent.logo_url,
      brand_colors: sourceEvent.brand_colors,
      teams_config: [
        { slotNumber: 1, color: '#7C3AED' },
        { slotNumber: 2, color: '#0891B2' },
      ],
      stages_config: [
        {
          id: crypto.randomUUID(),
          name: 'Bingo smoke test',
          type: 'bingo',
          gameId: SOURCE_GAME_ID,
          gameIds: [],
        },
      ],
      display_layout: sourceEvent.display_layout,
      display_text_color: sourceEvent.display_text_color,
      invoice_paid: true,
    })
    .select('*')
    .single()
  if (createEventError) throw createEventError

  const { error: attachError } = await admin
    .from('event_games')
    .insert({ event_id: event.id, game_id: SOURCE_GAME_ID })
  if (attachError) throw attachError

  const { data: teams, error: teamError } = await admin
    .from('teams')
    .insert([
      {
        event_id: event.id,
        name: null,
        slot_number: 1,
        color: '#7C3AED',
        status: 'idle',
      },
      {
        event_id: event.id,
        name: null,
        slot_number: 2,
        color: '#0891B2',
        status: 'idle',
      },
    ])
    .select('*')
  if (teamError) throw teamError

  const playOrder = tracks.map((track) => track.id)
  const { data: run, error: runError } = await admin
    .from('bingo_runs')
    .insert({
      event_id: event.id,
      game_id: SOURCE_GAME_ID,
      stage_index: 0,
      play_order: playOrder,
      current_play_index: 0,
      status: 'active',
    })
    .select('*')
    .single()
  if (runError) throw runError

  const cells = tracks.slice(0, 25).map((track) => ({
    trackId: track.id,
    title: track.title,
    artist: track.artist,
  }))
  const { error: cardError } = await admin.from('bingo_team_cards').insert(
    teams.map((team, index) => ({
      run_id: run.id,
      team_id: team.id,
      cells: index === 0 ? cells : [...cells].reverse(),
    })),
  )
  if (cardError) throw cardError

  const { error: stateError } = await admin.from('event_state').insert({
    event_id: event.id,
    current_stage_index: 0,
    current_question_index: 0,
    bingo_state: 'waiting',
    bingo_revealed_track_ids: [],
    bingo_winner_team_id: null,
    bingo_announced_winner_ids: [],
  })
  if (stateError) throw stateError

  const email = `${EMAIL_PREFIX}${stamp}@example.test`
  const password = `Smoke-${crypto.randomUUID()}-Aa1!`
  const { data: createdUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) throw authError
  const userId = createdUser.user.id
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    username: email,
    full_name: 'Codex Bingo Smoke',
    first_name: 'Codex',
    last_name: 'Smoke',
    role: 'facilitator',
    organization_id: event.organization_id,
    must_change_password: false,
  })
  if (profileError) throw profileError

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('subdomain')
    .eq('id', event.organization_id)
    .single()
  if (orgError) throw orgError

  console.log(
    JSON.stringify({
      eventId: event.id,
      gameId: SOURCE_GAME_ID,
      runId: run.id,
      teamIds: teams.map((team) => team.id),
      tenant: org.subdomain,
      email,
      password,
    }),
  )
}

async function reset(eventId) {
  if (!eventId) throw new Error('reset requires an event id')
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id,name')
    .eq('id', eventId)
    .single()
  if (eventError) throw eventError
  if (!event.name.startsWith(EVENT_PREFIX)) {
    throw new Error('Refusing to reset a non-smoke event')
  }

  const [{ error: submissionError }, { error: teamError }, { error: runError }] =
    await Promise.all([
      admin
        .from('submissions')
        .delete()
        .eq('event_id', eventId)
        .eq('media_type', 'bingo')
        .neq('media_url', 'claim'),
      admin.from('teams').update({ score: 0 }).eq('event_id', eventId),
      admin
        .from('bingo_runs')
        .update({ current_play_index: 0, paid_line_bonus_team_ids: [] })
        .eq('event_id', eventId),
    ])
  if (submissionError) throw submissionError
  if (teamError) throw teamError
  if (runError) throw runError

  const { error: stateError } = await admin
    .from('event_state')
    .update({
      current_question_index: 0,
      bingo_state: 'playing',
      bingo_revealed_track_ids: [],
      bingo_winner_team_id: null,
      bingo_announced_winner_ids: [],
    })
    .eq('event_id', eventId)
  if (stateError) throw stateError

  // Preserve any synthetic LOAD teams added during a scaling run and give each
  // one a correct pending mark for the first track. Fresh fixtures simply have
  // no matching teams, so this remains a normal one-player reset.
  const { data: loadTeams, error: loadTeamError } = await admin
    .from('teams')
    .select('id')
    .eq('event_id', eventId)
    .like('name', 'LOAD Team%')
  if (loadTeamError) throw loadTeamError
  if (loadTeams?.length) {
    const { error: loadSubmissionError } = await admin.from('submissions').insert(
      loadTeams.map((team) => ({
        event_id: eventId,
        game_id: SOURCE_GAME_ID,
        team_id: team.id,
        media_type: 'bingo',
        media_url: '0',
        status: 'pending',
      })),
    )
    if (loadSubmissionError) throw loadSubmissionError
  }

  console.log(
    JSON.stringify({ resetEventId: eventId, loadTeamMarks: loadTeams?.length ?? 0 }),
  )
}

async function inspect(eventId) {
  if (!eventId) throw new Error('inspect requires an event id')
  const [{ data: state, error: stateError }, { data: run, error: runError }, { data: submissions, error: submissionError }] =
    await Promise.all([
      admin.from('event_state').select('*').eq('event_id', eventId).single(),
      admin.from('bingo_runs').select('*').eq('event_id', eventId).single(),
      admin
        .from('submissions')
        .select('id,team_id,media_url,status,points_awarded')
        .eq('event_id', eventId)
        .eq('media_type', 'bingo'),
    ])
  if (stateError) throw stateError
  if (runError) throw runError
  if (submissionError) throw submissionError
  console.log(JSON.stringify({ state, run, submissions }))
}

async function prepareWinner(eventId, teamId) {
  if (!eventId || !teamId) throw new Error('prepare-winner requires event and team ids')
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id,name')
    .eq('id', eventId)
    .single()
  if (eventError) throw eventError
  if (!event.name.startsWith(EVENT_PREFIX)) {
    throw new Error('Refusing to alter a non-smoke event')
  }
  const { data: team, error: teamError } = await admin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('event_id', eventId)
    .single()
  if (teamError) throw teamError

  const { error: submissionError } = await admin.from('submissions').insert(
    [1, 2, 3, 4].map((index) => ({
      event_id: eventId,
      game_id: SOURCE_GAME_ID,
      team_id: team.id,
      media_type: 'bingo',
      media_url: String(index),
      status: 'approved',
      points_awarded: 0,
    })),
  )
  if (submissionError) throw submissionError
  console.log(JSON.stringify({ preparedWinnerTeamId: team.id }))
}

async function announceWinner(eventId, teamId) {
  if (!eventId || !teamId) throw new Error('announce-winner requires event and team ids')
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id,name')
    .eq('id', eventId)
    .single()
  if (eventError) throw eventError
  if (!event.name.startsWith(EVENT_PREFIX)) {
    throw new Error('Refusing to alter a non-smoke event')
  }
  const { data: team, error: teamError } = await admin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('event_id', eventId)
    .single()
  if (teamError) throw teamError

  const { error: stateError } = await admin
    .from('event_state')
    .update({
      bingo_state: 'revealed',
      bingo_winner_team_id: team.id,
      bingo_announced_winner_ids: [team.id],
    })
    .eq('event_id', eventId)
  if (stateError) throw stateError
  console.log(JSON.stringify({ announcedWinnerTeamId: team.id }))
}

const command = process.argv[2]
if (command === 'setup') await setup()
else if (command === 'reset') await reset(process.argv[3])
else if (command === 'inspect') await inspect(process.argv[3])
else if (command === 'prepare-winner') await prepareWinner(process.argv[3], process.argv[4])
else if (command === 'announce-winner') await announceWinner(process.argv[3], process.argv[4])
else if (command === 'cleanup') await cleanup()
else throw new Error('Use setup, reset, inspect, prepare-winner, announce-winner, or cleanup')
