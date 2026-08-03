/**
 * Swaps one word in each crossword whose current word list cannot be laid out
 * on the 6x6 grid, then lets repair-crossword-layouts.mjs re-lay them.
 *
 *   node cw-swap.mjs --apply
 */
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const BASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

/**
 * One word per puzzle, chosen because it is the word that cannot cross
 * anything: SALT only shares a letter with PAN, MOSS only with CAMP, and so on.
 * Each replacement was checked to produce a grid that spells nothing extra.
 */
const SWAPS = {
  'Grid Rally: Kitchen': { from: 'SALT', to: 'STOVE', clue: 'The hob the pans sit on' },
  'Grid Rally: Outdoors': { from: 'TENT', to: 'SHADE', clue: 'Cool spot out of the sun' },
  'Grid Rally: Celebration': { from: 'DANCE', to: 'GUEST', clue: 'Someone on the invite list' },
  'Grid Rally: Office Life': { from: 'DESK', to: 'FILE', clue: 'Where a document is kept' },
  'Grid Rally: Music': { from: 'DRUM', to: 'STAGE', clue: 'Where the band plays' },
}

const games = await (
  await fetch(`${BASE}/rest/v1/games?type=eq.puzzle&select=id,name,config`, { headers })
).json()

let touched = 0
for (const game of games) {
  if (game.config?.puzzle_type !== 'crossword') continue
  const swap = SWAPS[game.name]
  if (!swap) continue
  const words = game.config.puzzle_crossword_words ?? []
  const target = words.find((w) => w.answer.toUpperCase() === swap.from)
  if (!target) continue

  const next = words.map((w) =>
    w.id === target.id ? { ...w, answer: swap.to, clue: swap.clue } : w,
  )
  console.log(`${game.name}: ${swap.from} -> ${swap.to}`)
  if (APPLY) {
    const res = await fetch(`${BASE}/rest/v1/games?id=eq.${game.id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ config: { ...game.config, puzzle_crossword_words: next } }),
    })
    if (!res.ok) { console.log(`  failed: ${res.status} ${await res.text()}`); continue }
  }
  touched += 1
}
console.log(`\n${touched} ${APPLY ? 'swapped' : 'would swap'}`)
