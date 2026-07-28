/**
 * Seeds the puzzle catalogue from docs/GAME-CONTENT-PLAN-PUZZLES.md into the
 * RallyHub Game Library org as platform templates.
 *
 * Usage:
 *   node scripts/seed-puzzle-library.mjs --dry
 *   node scripts/seed-puzzle-library.mjs
 *   node scripts/seed-puzzle-library.mjs --remove
 *
 * Crosswords are not seeded: a 6x6 grid needs each word placed at a row/col with
 * a direction, and guessing placements produces unsolvable grids. Their word
 * banks are in the plan; lay them out in the editor, which auto-detects runs and
 * forces a clue on each.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_SUBDOMAIN = 'rallyhub-library'
const GROUP_NAME = 'Puzzles'

function loadEnv() {
  const path = resolve(root, '.env')
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

const WORDLE = [
  ['Word Rally: Teamwork', 'TRUST', 'latin'],
  ['Word Rally: The Office', 'EMAIL', 'latin'],
  ['Word Rally: Coffee Break', 'BEANS', 'latin'],
  ['Word Rally: On the Move', 'TRAIN', 'latin'],
  ['Word Rally: Summer', 'BEACH', 'latin'],
  ['Word Rally: Winter', 'FROST', 'latin'],
  ['Word Rally: Music', 'CHORD', 'latin'],
  ['Word Rally: Food', 'BREAD', 'latin'],
  ['Word Rally: Sport', 'MEDAL', 'latin'],
  ['Word Rally: Nature', 'RIVER', 'latin'],
  ['Word Rally: Celebration', 'PARTY', 'latin'],
  ['Дума Rally: Отбор', 'ЕКИПИ', 'cyrillic'],
]

const MATCHING = [
  [
    'Match Rally: Capitals of Europe',
    [
      ['France', 'Paris'],
      ['Portugal', 'Lisbon'],
      ['Austria', 'Vienna'],
      ['Bulgaria', 'Sofia'],
      ['Ireland', 'Dublin'],
      ['Norway', 'Oslo'],
    ],
  ],
  [
    'Match Rally: Capitals of the World',
    [
      ['Japan', 'Tokyo'],
      ['Peru', 'Lima'],
      ['Kenya', 'Nairobi'],
      ['Canada', 'Ottawa'],
      ['Vietnam', 'Hanoi'],
      ['Morocco', 'Rabat'],
    ],
  ],
  [
    'Match Rally: Who Invented It',
    [
      ['Telephone', 'Bell'],
      ['Lightbulb filament', 'Edison'],
      ['World Wide Web', 'Berners-Lee'],
      ['Dynamite', 'Nobel'],
      ['Printing press', 'Gutenberg'],
      ['Polio vaccine', 'Salk'],
    ],
  ],
  [
    'Match Rally: Animal Groups',
    [
      ['Crows', 'Murder'],
      ['Lions', 'Pride'],
      ['Geese', 'Gaggle'],
      ['Fish', 'School'],
      ['Wolves', 'Pack'],
      ['Owls', 'Parliament'],
    ],
  ],
  [
    'Match Rally: Office Jargon Decoder',
    [
      ['Circle back', 'Talk again later'],
      ['Low-hanging fruit', 'Easy win'],
      ['Bandwidth', 'Spare time'],
      ['Touch base', 'Quick catch-up'],
      ['Deep dive', 'Detailed look'],
      ['Move the needle', 'Make real progress'],
    ],
  ],
  [
    'Match Rally: Units and Measures',
    [
      ['Distance', 'Metre'],
      ['Force', 'Newton'],
      ['Power', 'Watt'],
      ['Frequency', 'Hertz'],
      ['Pressure', 'Pascal'],
      ['Energy', 'Joule'],
    ],
  ],
  [
    'Match Rally: Landmarks to Cities',
    [
      ['Colosseum', 'Rome'],
      ['Acropolis', 'Athens'],
      ['Sagrada Familia', 'Barcelona'],
      ['Charles Bridge', 'Prague'],
      ['Little Mermaid', 'Copenhagen'],
      ['Atomium', 'Brussels'],
    ],
  ],
  [
    'Match Rally: Sports and Their Terms',
    [
      ['Tennis', 'Deuce'],
      ['Golf', 'Birdie'],
      ['Cricket', 'Googly'],
      ['Basketball', 'Alley-oop'],
      ['Fencing', 'Riposte'],
      ['Rowing', 'Coxswain'],
    ],
  ],
  [
    'Match Rally: Team Roles',
    [
      ['The Finisher', 'Chases every loose end until it is closed'],
      ['The Planner', 'Turns a vague goal into concrete steps'],
      ['The Challenger', 'Asks the awkward question nobody else will'],
      ['The Connector', 'Knows who to ask and introduces them'],
      ['The Steadier', 'Keeps the group calm when it wobbles'],
      ['The Spark', 'Produces ten ideas so one can be brilliant'],
    ],
  ],
  [
    'Match Rally: Kitchen Basics',
    [
      ['Whisk', 'Beats air into a mixture'],
      ['Colander', 'Drains water from food'],
      ['Grater', 'Shreds cheese and vegetables'],
      ['Ladle', 'Serves soup from a pot'],
      ['Peeler', 'Takes the skin off vegetables'],
      ['Rolling pin', 'Flattens dough'],
    ],
  ],
]

function wordleGames() {
  return WORDLE.map(([name, answer, alphabet]) => ({
    name,
    type: 'puzzle',
    description: `Guess the hidden ${Array.from(answer).length}-letter word. Every extra guess costs points.`,
    points_type: 'static',
    points_static: 100,
    points_min: null,
    points_max: null,
    is_platform_template: true,
    status: 'active',
    config: {
      puzzle_type: 'wordle',
      puzzle_wordle_answer: answer,
      puzzle_wordle_length: Array.from(answer).length,
      puzzle_keyboard_alphabet: alphabet,
    },
  }))
}

function matchingGames() {
  return MATCHING.map(([name, pairs]) => ({
    name,
    type: 'puzzle',
    description: 'Match every item on the left to its partner on the right. Wrong pairs cost points.',
    points_type: 'static',
    points_static: 80,
    points_min: null,
    points_max: null,
    is_platform_template: true,
    status: 'active',
    config: {
      puzzle_type: 'matching',
      // Deterministic ids so re-running updates the same pairs instead of
      // orphaning any progress already recorded against them.
      puzzle_matching_pairs: pairs.map(([left, right], i) => ({
        id: `p${i + 1}`,
        left,
        right,
      })),
    },
  }))
}

async function main() {
  const mode = process.argv[2] ?? ''
  const games = [...wordleGames(), ...matchingGames()]

  console.log(`puzzle games to seed: ${games.length}`)
  console.log(`  wordle   : ${WORDLE.length}`)
  console.log(`  matching : ${MATCHING.length}`)
  console.log('  crossword: 0 (grids must be laid out in the editor, see the plan)')
  if (mode === '--dry') return

  const env = { ...loadEnv(), ...process.env }
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('subdomain', LIBRARY_SUBDOMAIN)
    .single()
  if (orgError) throw orgError
  console.log(`\nlibrary org: ${org.name}`)

  const names = games.map((g) => g.name)

  if (mode === '--remove') {
    const { data: gone } = await admin
      .from('games')
      .delete()
      .eq('organization_id', org.id)
      .in('name', names)
      .select('id')
    await admin.from('game_groups').delete().eq('organization_id', org.id).eq('name', GROUP_NAME)
    console.log(`removed ${gone?.length ?? 0} puzzle games`)
    return
  }

  const { data: existing } = await admin
    .from('games')
    .select('id, name')
    .eq('organization_id', org.id)
    .in('name', names)
  const byName = new Map((existing ?? []).map((g) => [g.name, g.id]))

  let created = 0
  let updated = 0
  const idByName = new Map(byName)
  for (const game of games) {
    const id = byName.get(game.name)
    if (id) {
      const { error } = await admin.from('games').update(game).eq('id', id)
      if (error) throw error
      updated++
    } else {
      const { data, error } = await admin
        .from('games')
        .insert({ ...game, organization_id: org.id })
        .select('id')
        .single()
      if (error) throw error
      idByName.set(game.name, data.id)
      created++
    }
  }
  console.log(`games: ${created} created, ${updated} updated`)

  let { data: group } = await admin
    .from('game_groups')
    .select('id')
    .eq('organization_id', org.id)
    .eq('name', GROUP_NAME)
    .maybeSingle()
  if (!group) {
    const { data, error } = await admin
      .from('game_groups')
      .insert({ organization_id: org.id, name: GROUP_NAME })
      .select('id')
      .single()
    if (error) throw error
    group = data
  }
  const memberIds = games.map((g) => idByName.get(g.name)).filter(Boolean)
  await admin.from('game_group_items').delete().eq('group_id', group.id)
  const { error: itemsError } = await admin
    .from('game_group_items')
    .insert(memberIds.map((game_id) => ({ group_id: group.id, game_id })))
  if (itemsError) throw itemsError
  console.log(`group "${GROUP_NAME}": ${memberIds.length} games`)
}

await main()
