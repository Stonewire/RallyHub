/**
 * Seeds the themed quizzes in scripts/data/quizzes into the RallyHub Game
 * Library org as platform templates.
 *
 * Usage:
 *   node scripts/seed-quiz-library.mjs --dry
 *   node scripts/seed-quiz-library.mjs
 *   node scripts/seed-quiz-library.mjs --remove
 *
 * Run scripts/check-quizzes.mjs first; this script assumes the data is sound.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { shuffleOptions } from './lib/quiz-shuffle.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_SUBDOMAIN = 'rallyhub-library'
const GROUP_NAME = 'Quizzes'
const ROUNDS = [
  ['easy', 'Round 1 — Easy'],
  ['medium', 'Round 2 — Medium'],
  ['hard', 'Round 3 — Hard'],
]
const POINTS_PER_QUESTION = 20
const TIMER_SECONDS = 10

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

/** Stable ids, so re-seeding edits a quiz in place instead of replacing it. */
function stableId(...parts) {
  const text = parts.join('|')
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const a = (h >>> 0).toString(16).padStart(8, '0')
  let g = 5381
  for (let i = 0; i < text.length; i++) g = (Math.imul(g, 33) + text.charCodeAt(i)) >>> 0
  const b = g.toString(16).padStart(8, '0')
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-8${a.slice(0, 3)}-${b}${a.slice(0, 4)}`
}

function toGame(quiz) {
  const questions = []
  const rounds = []

  for (const [key, roundName] of ROUNDS) {
    const roundId = stableId(quiz.name, key)
    const questionIds = []
    quiz[key].forEach(([text, options, correct], i) => {
      const questionId = stableId(quiz.name, key, String(i), text)
      // Written with the answer wherever it read best, shuffled here so teams do
      // not spot a pattern in which slot is correct.
      const shuffled = shuffleOptions(text, options, correct)
      const answers = shuffled.options.map((option, j) => ({
        id: stableId(questionId, String(j), option),
        text: option,
      }))
      questions.push({
        id: questionId,
        text,
        answers,
        correctAnswerId: answers[shuffled.correctIndex].id,
        roundId,
      })
      questionIds.push(questionId)
    })
    rounds.push({ id: roundId, name: roundName, questionIds })
  }

  return {
    name: quiz.name,
    type: 'quiz',
    description: `${questions.length} questions in three rounds: easy, medium, then hard.`,
    points_type: 'static',
    points_static: POINTS_PER_QUESTION,
    points_min: null,
    points_max: null,
    is_platform_template: true,
    status: 'active',
    config: {
      questions,
      rounds,
      rounds_enabled: true,
      timer_seconds: TIMER_SECONDS,
    },
  }
}

async function main() {
  const mode = process.argv[2] ?? ''
  const dir = resolve(root, 'scripts/data/quizzes')
  const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()

  const games = []
  for (const file of files) {
    const quiz = (await import(resolve(dir, file))).default
    games.push(toGame(quiz))
  }

  console.log(`quizzes to seed: ${games.length}`)
  for (const g of games) {
    console.log(`  ${g.name}: ${g.config.questions.length} questions, ${g.config.rounds.length} rounds`)
  }
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
    console.log(`removed ${gone?.length ?? 0} quizzes`)
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
  console.log(`quizzes: ${created} created, ${updated} updated`)

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
  console.log(`group "${GROUP_NAME}": ${memberIds.length} quizzes`)
}

await main()
