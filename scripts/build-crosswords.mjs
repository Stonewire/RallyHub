/**
 * Searches for valid 6x6 crossword layouts from a themed word bank.
 *
 * The player-side engine treats EVERY straight run of 2+ letters as a word that
 * needs a clue, so a layout is only valid if the runs it produces are exactly
 * the words we intended. Two words sitting in adjacent parallel rows quietly
 * create extra two-letter runs, which is why this searches instead of guessing.
 */
const SIZE = 6
const MIN_CROSSINGS = 3

const BANKS = [
  {
    name: 'Grid Rally: Office Life',
    clues: {
      DESK: 'Where you sit to work',
      EMAIL: 'Message with a subject line',
      TEAM: 'Group working together',
      MEET: 'Gather to discuss',
      NOTE: 'Short written reminder',
      CHAIR: 'You sit on it, or you run the meeting',
    },
  },
  {
    name: 'Grid Rally: On Tour',
    clues: {
      MAP: 'It shows you the way',
      TRAIN: 'Runs on rails',
      HOTEL: 'Where you sleep away from home',
      PACK: 'Fill your suitcase',
      GATE: 'Where you board the plane',
      TOUR: 'Organised trip around the sights',
    },
  },
  {
    name: 'Grid Rally: Kitchen',
    clues: {
      OVEN: 'It bakes and roasts',
      SALT: 'The most basic seasoning',
      RICE: 'Grain served with curry',
      PAN: 'You fry in it',
      HERB: 'Basil or thyme, for example',
      CHEF: 'Runs the kitchen',
    },
  },
  {
    name: 'Grid Rally: Outdoors',
    clues: {
      TENT: 'Canvas shelter for the night',
      PATH: 'Narrow way through the woods',
      LAKE: 'Still water surrounded by land',
      MOSS: 'Soft green growth on stones',
      HILL: 'Smaller than a mountain',
      CAMP: 'Set up for the night outdoors',
    },
  },
  {
    name: 'Grid Rally: Music',
    clues: {
      DRUM: 'You hit it to keep time',
      BASS: 'The low end',
      SONG: 'Words set to music',
      TUNE: 'A melody, or what you do to a guitar',
      BAND: 'Group that plays together',
      NOTE: 'Single sound on a stave',
    },
  },
  {
    name: 'Grid Rally: Celebration',
    clues: {
      CAKE: 'It arrives with candles',
      TOAST: 'Raise a glass, or breakfast',
      GIFT: 'Wrapped and given',
      DANCE: 'Move to the music',
      HOST: 'Throws the party',
      CHEER: 'Loud shout of approval',
    },
  },
]

const key = (r, c) => `${r}-${c}`

/** Every maximal straight run of 2+ filled cells, across and down. */
function runsOf(grid) {
  const out = []
  for (let r = 0; r < SIZE; r++) {
    let c = 0
    while (c < SIZE) {
      if (!grid[r][c]) { c++; continue }
      let e = c
      while (e + 1 < SIZE && grid[r][e + 1]) e++
      if (e > c) out.push({ row: r, col: c, direction: 'across', length: e - c + 1, word: grid[r].slice(c, e + 1).join('') })
      c = e + 1
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let r = 0
    while (r < SIZE) {
      if (!grid[r][c]) { r++; continue }
      let e = r
      while (e + 1 < SIZE && grid[e + 1][c]) e++
      if (e > r) {
        let word = ''
        for (let i = r; i <= e; i++) word += grid[i][c]
        out.push({ row: r, col: c, direction: 'down', length: e - r + 1, word })
      }
      r = e + 1
    }
  }
  return out
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ''))
}

function place(grid, word, row, col, direction) {
  const next = grid.map((r) => [...r])
  for (let i = 0; i < word.length; i++) {
    const r = direction === 'down' ? row + i : row
    const c = direction === 'down' ? col : col + i
    if (r >= SIZE || c >= SIZE) return null
    if (next[r][c] && next[r][c] !== word[i]) return null
    next[r][c] = word[i]
  }
  return next
}

/** A layout is valid when its runs are exactly the placed words, each crossing. */
function validate(grid, placed) {
  const runs = runsOf(grid)
  if (runs.length !== placed.length) return false
  const want = new Set(placed.map((p) => `${p.row}-${p.col}-${p.direction}-${p.answer}`))
  for (const run of runs) {
    if (!want.has(`${run.row}-${run.col}-${run.direction}-${run.word}`)) return false
  }
  // The plan asks for at least three crossings so the grid plays as one puzzle
  // rather than a handful of unrelated words sharing a page.
  const cellOwners = new Map()
  for (const p of placed) {
    for (let i = 0; i < p.answer.length; i++) {
      const r = p.direction === 'down' ? p.row + i : p.row
      const c = p.direction === 'down' ? p.col : p.col + i
      cellOwners.set(key(r, c), [...(cellOwners.get(key(r, c)) ?? []), p.id])
    }
  }
  let crossings = 0
  for (const owners of cellOwners.values()) if (owners.length > 1) crossings++
  return crossings >= MIN_CROSSINGS
}

function search(words, grid = emptyGrid(), placed = [], depth = 0) {
  if (depth === words.length) return validate(grid, placed) ? { grid, placed } : null
  const answer = words[depth]
  for (const direction of ['across', 'down']) {
    const maxRow = direction === 'down' ? SIZE - answer.length : SIZE - 1
    const maxCol = direction === 'across' ? SIZE - answer.length : SIZE - 1
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= maxCol; col++) {
        const next = place(grid, answer, row, col, direction)
        if (!next) continue
        const entry = { id: `w${depth + 1}`, answer, row, col, direction }
        // Prune early: partial layouts may not yet cross, but must never create a
        // run that is not one of our words.
        const runs = runsOf(next)
        const placedNow = [...placed, entry]
        const ok = runs.every((run) =>
          placedNow.some(
            (p) =>
              p.row === run.row &&
              p.col === run.col &&
              p.direction === run.direction &&
              p.answer === run.word,
          ),
        )
        if (!ok) continue
        const found = search(words, next, placedNow, depth + 1)
        if (found) return found
      }
    }
  }
  return null
}

const results = []
for (const bank of BANKS) {
  const all = Object.keys(bank.clues).sort((a, b) => b.length - a.length)
  let found = search(all)
  let words = all
  // A 6x6 grid cannot always hold six words without creating stray runs. Drop
  // the least useful word rather than shipping an invalid grid.
  for (let drop = 0; !found && drop < all.length; drop++) {
    words = all.filter((_, i) => i !== all.length - 1 - drop)
    found = search(words)
  }
  if (!found) {
    console.error(`FAILED: ${bank.name}`)
    continue
  }
  const cells = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (found.grid[r][c]) cells.push({ row: r, col: c })
  }
  const numbers = new Map()
  let n = 0
  const ordered = [...found.placed].sort((a, b) => a.row - b.row || a.col - b.col)
  for (const p of ordered) {
    const k = key(p.row, p.col)
    if (!numbers.has(k)) numbers.set(k, ++n)
  }
  results.push({
    name: bank.name,
    words: found.placed.map((p) => ({
      id: p.id,
      answer: p.answer,
      clue: bank.clues[p.answer],
      row: p.row,
      col: p.col,
      direction: p.direction,
    })),
    layout: {
      cells,
      blocked: [],
      clues: found.placed.map((p) => ({
        id: p.id,
        number: numbers.get(key(p.row, p.col)),
        direction: p.direction,
        row: p.row,
        col: p.col,
        length: p.answer.length,
        clue: bank.clues[p.answer],
      })),
    },
  })
  console.error(`ok: ${bank.name} (${found.placed.length} words, ${cells.length} cells)`)
  for (let r = 0; r < SIZE; r++) {
    console.error('   ' + found.grid[r].map((x) => x || '.').join(' '))
  }
}

console.log(JSON.stringify(results, null, 2))
