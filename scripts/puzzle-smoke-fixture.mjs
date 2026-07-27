/**
 * Throwaway puzzle event (Wordle + Matching + Crossword) for browser smoke tests.
 *
 * Usage:
 *   node scripts/puzzle-smoke-fixture.mjs setup
 *   node scripts/puzzle-smoke-fixture.mjs cleanup
 *
 * Setup prints the event id; open /join/<event-id> to play. Cleanup removes every
 * event and game carrying the PUZZLE SMOKE prefix.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EVENT_PREFIX = 'PUZZLE SMOKE'
const GAME_PREFIX = 'PUZZLE SMOKE'

function loadEnv() {
  const path = `${root}/.env`
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = { ...loadEnv(), ...process.env }
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Two words crossing on their first letter, so one cell carries an across and a
// down clue. That is the case the clue panel has to handle.
const CROSSWORD_WORDS = [
  { id: 'w-across', answer: 'CAT', clue: 'Purring pet', row: 2, col: 1, direction: 'across' },
  { id: 'w-down', answer: 'CAR', clue: 'It has four wheels', row: 2, col: 1, direction: 'down' },
]

function crosswordLayout(words) {
  const cells = new Map()
  const clues = words.map((w, i) => {
    for (let n = 0; n < w.answer.length; n++) {
      const row = w.direction === 'down' ? w.row + n : w.row
      const col = w.direction === 'down' ? w.col : w.col + n
      cells.set(`${row}-${col}`, { row, col })
    }
    return {
      id: w.id,
      number: i === 0 ? 1 : 1,
      direction: w.direction,
      row: w.row,
      col: w.col,
      length: w.answer.length,
      clue: w.clue,
    }
  })
  return { cells: [...cells.values()], blocked: [], clues }
}

const GAMES = [
  {
    name: `${GAME_PREFIX} Wordle`,
    type: 'puzzle',
    points_type: 'static',
    points_static: 100,
    config: {
      puzzle_type: 'wordle',
      puzzle_wordle_answer: 'PLANT',
      puzzle_wordle_length: 5,
      puzzle_keyboard_alphabet: 'latin',
    },
  },
  {
    name: `${GAME_PREFIX} Matching`,
    type: 'puzzle',
    points_type: 'static',
    points_static: 80,
    config: {
      puzzle_type: 'matching',
      puzzle_matching_pairs: [
        { id: 'p1', left: 'France', right: 'Paris' },
        { id: 'p2', left: 'Japan', right: 'Tokyo' },
        { id: 'p3', left: 'Peru', right: 'Lima' },
      ],
    },
  },
  {
    name: `${GAME_PREFIX} Crossword`,
    type: 'puzzle',
    points_type: 'static',
    points_static: 120,
    config: {
      puzzle_type: 'crossword',
      puzzle_crossword_words: CROSSWORD_WORDS,
      puzzle_crossword_layout: crosswordLayout(CROSSWORD_WORDS),
      puzzle_keyboard_alphabet: 'latin',
    },
  },
]

async function cleanup() {
  const { data: events } = await admin
    .from('events')
    .select('id')
    .like('name', `${EVENT_PREFIX}%`)
  for (const e of events ?? []) await admin.from('events').delete().eq('id', e.id)
  await admin.from('games').delete().like('name', `${GAME_PREFIX}%`)
  console.log(`cleaned ${events?.length ?? 0} event(s)`)
}

async function setup() {
  await cleanup()
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select("id, name, subdomain")
    .order('created_at')
    .limit(1)
    .single()
  if (orgError) throw orgError

  const { data: games, error: gameError } = await admin
    .from('games')
    .insert(GAMES.map((g) => ({ ...g, organization_id: org.id })))
    .select('id, name, config')
  if (gameError) throw gameError

  const stamp = Date.now()
  const { data: event, error: eventError } = await admin
    .from('events')
    .insert({
      organization_id: org.id,
      name: `${EVENT_PREFIX} ${stamp}`,
      status: 'demo',
      team_count: 2,
      teams_config: [
        { slotNumber: 1, color: '#7C3AED' },
        { slotNumber: 2, color: '#0891B2' },
      ],
      stages_config: [
        {
          id: crypto.randomUUID(),
          name: 'Puzzle quest',
          type: 'open',
          gameId: null,
          gameIds: games.map((g) => g.id),
        },
      ],
      invoice_paid: true,
    })
    .select('*')
    .single()
  if (eventError) throw eventError

  const { error: attachError } = await admin
    .from('event_games')
    .insert(games.map((g) => ({ event_id: event.id, game_id: g.id })))
  if (attachError) throw attachError

  const { error: teamError } = await admin.from('teams').insert([
    { event_id: event.id, name: null, slot_number: 1, color: '#7C3AED', status: 'idle' },
    { event_id: event.id, name: null, slot_number: 2, color: '#0891B2', status: 'idle' },
  ])
  if (teamError) throw teamError

  const { error: stateError } = await admin.from('event_state').insert({
    event_id: event.id,
    current_stage_index: 0,
    current_question_index: 0,
  })
  if (stateError) throw stateError

  console.log(JSON.stringify({ orgSubdomain: org.subdomain, eventId: event.id, games: games.map((g) => ({ id: g.id, name: g.name })) }, null, 2))
}

const cmd = process.argv[2]
if (cmd === 'setup') await setup()
else if (cmd === 'cleanup') await cleanup()
else console.error('usage: setup | cleanup')
