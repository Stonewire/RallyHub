/**
 * Re-lays the crossword grids that fail the connectivity rule.
 *
 * Answers and clues are kept exactly as they are; only row/col/direction move,
 * so the puzzle content is untouched and only its geometry is repaired.
 *
 *   node cw-fix.mjs           # report what it would write
 *   node cw-fix.mjs --apply   # write it
 */
import { readFileSync } from 'node:fs'

const SIZE = 6
const APPLY = process.argv.includes('--apply')

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const BASE = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const cellsOf = (w) =>
  [...w.answer].map((_, i) => ({
    row: w.direction === 'down' ? w.row + i : w.row,
    col: w.direction === 'across' ? w.col + i : w.col,
  }))

/** Connected as one group, the rule validateCrosswordWords enforces. */
function connected(words) {
  const owners = new Map()
  words.forEach((w, i) => {
    for (const { row, col } of cellsOf(w)) {
      const k = `${row}-${col}`
      owners.set(k, [...(owners.get(k) ?? []), i])
    }
  })
  const adj = words.map(() => new Set())
  for (const list of owners.values())
    for (const a of list) for (const b of list) if (a !== b) adj[a].add(b)
  const seen = new Set([0])
  const q = [0]
  while (q.length) {
    const c = q.pop()
    for (const n of adj[c]) if (!seen.has(n)) { seen.add(n); q.push(n) }
  }
  return seen.size === words.length
}

/**
 * Every maximal run of two or more letters in the grid, across and down.
 *
 * The editor treats each of those as a word that needs a clue, so a layout
 * that merely satisfies validateCrosswordWords can still be unusable: pack two
 * words on adjacent rows and the columns spell things like EDTO and ASAE, and
 * the editor asks for clues for them. Real crosswords forbid exactly this.
 */
function runsOf(grid) {
  const runs = []
  for (const direction of ['across', 'down']) {
    for (let a = 0; a < SIZE; a += 1) {
      let start = null
      let text = ''
      for (let b = 0; b <= SIZE; b += 1) {
        const row = direction === 'across' ? a : b
        const col = direction === 'across' ? b : a
        const ch = b < SIZE ? grid.get(`${row}-${col}`) : undefined
        if (ch !== undefined) {
          if (start === null) start = b
          text += ch
        } else if (start !== null) {
          if (text.length >= 2) {
            runs.push({
              direction,
              row: direction === 'across' ? a : start,
              col: direction === 'across' ? start : a,
              text,
            })
          }
          start = null
          text = ''
        }
      }
    }
  }
  return runs
}

/** Runs in the grid that are not one of the words we meant to place. */
function extraRuns(grid, placed) {
  const want = new Set(
    placed.map((w) => `${w.direction}:${w.row}:${w.col}:${w.answer.toUpperCase()}`),
  )
  return runsOf(grid).filter((r) => !want.has(`${r.direction}:${r.row}:${r.col}:${r.text}`))
}

/** True when the grid spells nothing beyond the words we placed. */
function runsAreClean(grid, placed) {
  return extraRuns(grid, placed).length === 0
}

/**
 * Places every word so the grid is one connected group and spells nothing it
 * was not asked to.
 *
 * Depth-first over both which word goes next and where it goes, because with a
 * fixed order the run dies whenever the next word shares no letter with
 * anything placed so far.
 */
function solve(words, maxExtras = 0) {
  const sorted = [...words].sort((a, b) => b.answer.length - a.answer.length)

  const fits = (grid, word, row, col, direction) => {
    const letters = [...word.answer.toUpperCase()]
    if (row < 0 || col < 0) return null
    const endRow = direction === 'down' ? row + letters.length - 1 : row
    const endCol = direction === 'across' ? col + letters.length - 1 : col
    if (endRow >= SIZE || endCol >= SIZE) return null
    let crossings = 0
    const writes = []
    letters.forEach((ch, i) => {
      const r = direction === 'down' ? row + i : row
      const c = direction === 'across' ? col + i : col
      const existing = grid.get(`${r}-${c}`)
      if (existing !== undefined) {
        if (existing !== ch) { writes.length = 0; crossings = -1e9 }
        else crossings += 1
      }
      writes.push([`${r}-${c}`, ch])
    })
    if (crossings < 0) return null
    return { crossings, writes }
  }

  /**
   * Depth-first with backtracking. Greedy alone paints itself into a corner:
   * on a 6x6 grid the best-crossing placement for word three can leave word
   * five nowhere legal to go, and the run has to be undone rather than
   * abandoned.
   */
  const attempt = (order) => {
    const grid = new Map()
    const placed = []

    const remaining = new Set(order.map((w) => w.id))

    const search = () => {
      if (remaining.size === 0) return true
      const first = placed.length === 0

      // Which word goes next is part of the search, not fixed up front. With a
      // fixed order the run dies whenever the next word shares no letter with
      // anything placed so far: SALT cannot cross OVEN, RICE or CHEF, only
      // PAN, so any order that reaches SALT before PAN is dead even though the
      // puzzle is perfectly solvable.
      const candidates = []
      for (const word of order) {
        if (!remaining.has(word.id)) continue
        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            for (const direction of ['across', 'down']) {
              const f = fits(grid, word, row, col, direction)
              if (f && (first || f.crossings > 0)) {
                candidates.push({ word, row, col, direction, ...f })
              }
            }
          }
        }
        if (first) break
      }
      // Densest first: a grid with more shared letters reads like a crossword
      // rather than a scatter of words.
      candidates.sort((a, b) => b.crossings - a.crossings)

      for (const option of candidates) {
        const undo = []
        for (const [k, v] of option.writes) {
          if (!grid.has(k)) undo.push(k)
          grid.set(k, v)
        }
        remaining.delete(option.word.id)
        placed.push({
          ...option.word,
          row: option.row,
          col: option.col,
          direction: option.direction,
        })
        // Prune as soon as the grid spells more than the budget allows,
        // rather than discovering it only at the end.
        if (extraRuns(grid, placed).length <= maxExtras && search()) return true
        placed.pop()
        remaining.add(option.word.id)
        for (const k of undo) grid.delete(k)
      }
      return false
    }

    if (!search()) return null
    const byId = new Map(placed.map((w) => [w.id, w]))
    const result = words.map((w) => byId.get(w.id))
    return connected(result) ? result : null
  }

  // A few orderings, since a greedy pass can paint itself into a corner.
  const orders = [sorted]
  for (let i = 1; i < sorted.length; i += 1) {
    orders.push([sorted[i], ...sorted.filter((_, j) => j !== i)])
  }
  for (let seed = 0; seed < 40; seed += 1) {
    const shuffled = [...sorted]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = (seed * 7 + i * 13) % (i + 1)
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    orders.push(shuffled)
  }
  for (const order of orders) {
    const out = attempt(order)
    if (out) return out
  }
  return null
}

/** Same numbering rules as buildCrosswordLayout in the app. */
function buildLayout(words, blocked) {
  const letters = new Map()
  for (const w of words) {
    const chars = [...w.answer.toLocaleLowerCase()]
    cellsOf(w).forEach(({ row, col }, i) => letters.set(`${row}-${col}`, chars[i]))
  }
  const cells = [...letters.keys()]
    .map((k) => {
      const [row, col] = k.split('-').map(Number)
      return { row, col }
    })
    .sort((a, b) => a.row - b.row || a.col - b.col)
  const startNumbers = new Map()
  let next = 1
  const clues = []
  const sorted = [...words].sort(
    (a, b) => a.row - b.row || a.col - b.col || (a.direction === 'across' ? -1 : 1),
  )
  for (const w of sorted) {
    const key = `${w.row}-${w.col}`
    let number = startNumbers.get(key)
    if (number === undefined) { number = next; next += 1; startNumbers.set(key, number) }
    clues.push({
      id: w.id,
      number,
      direction: w.direction,
      row: w.row,
      col: w.col,
      length: [...w.answer].length,
      clue: w.clue,
    })
  }
  return { cells, blocked, clues }
}

const games = await (
  await fetch(`${BASE}/rest/v1/games?type=eq.puzzle&select=id,name,config`, { headers })
).json()
const crosswords = games.filter((g) => g.config?.puzzle_type === 'crossword')

let fixed = 0
let failed = 0
for (const game of crosswords) {
  const words = game.config.puzzle_crossword_words ?? []
  if (words.length < 2) continue

  // Two ways a stored layout can be wrong: the words fall into separate
  // islands, or they sit close enough to spell runs nobody wrote a clue for.
  const current = new Map()
  for (const w of words) {
    const letters = [...w.answer.toUpperCase()]
    cellsOf(w).forEach(({ row, col }, i) => current.set(`${row}-${col}`, letters[i]))
  }
  if (connected(words) && runsAreClean(current, words)) continue

  // Zero accidental words if the letters allow it, otherwise as few as
  // possible: a grid that spells one extra pair is still far better than one
  // in separate pieces, and it tells us exactly how much slack the word list
  // has left.
  let placed = null
  let usedExtras = 0
  for (let budget = 0; budget <= 6 && !placed; budget += 1) {
    placed = solve(words, budget)
    usedExtras = budget
  }
  if (!placed) {
    failed += 1
    console.log(`COULD NOT SOLVE ${game.name}: ${words.map((w) => w.answer).join(', ')}`)
    continue
  }

  const blocked = game.config.puzzle_crossword_layout?.blocked ?? []
  const config = {
    ...game.config,
    puzzle_crossword_words: placed,
    puzzle_crossword_layout: buildLayout(placed, blocked),
  }

  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('.'))
  for (const w of placed) {
    const letters = [...w.answer.toUpperCase()]
    cellsOf(w).forEach(({ row, col }, i) => { grid[row][col] = letters[i] })
  }
  const gridMap = new Map()
  for (const w of placed) {
    const letters = [...w.answer.toUpperCase()]
    cellsOf(w).forEach(({ row, col }, i) => gridMap.set(`${row}-${col}`, letters[i]))
  }
  const extras = extraRuns(gridMap, placed)
  console.log(`\n${game.name}${extras.length ? `  (spells ${extras.map((e) => e.text).join(', ')})` : '  (clean)'}`)
  console.log(grid.map((r) => r.join(' ')).join('\n'))

  if (APPLY) {
    const res = await fetch(`${BASE}/rest/v1/games?id=eq.${game.id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ config }),
    })
    if (!res.ok) {
      console.log(`  write failed: ${res.status} ${await res.text()}`)
      continue
    }
  }
  fixed += 1
}

console.log(`\n${fixed} ${APPLY ? 'repaired' : 'solvable'}, ${failed} unsolved`)
