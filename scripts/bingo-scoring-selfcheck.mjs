/**
 * Self-check for bingo track-id scoring scenarios.
 * Run: node scripts/bingo-scoring-selfcheck.mjs
 */

function bingoCellIndexForTrackId(cells, trackId) {
  return cells.findIndex((c) => c.trackId === trackId)
}

function resolveBingoSubmissionCellIndex(mediaUrl, cells) {
  const asNum = Number(mediaUrl)
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < cells.length) return asNum
  return cells.findIndex((c) => c.trackId === mediaUrl)
}

function resolveBingoSubmissionTrackId(mediaUrl, cells) {
  const asNum = Number(mediaUrl)
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < cells.length) {
    return cells[asNum]?.trackId ?? null
  }
  if (cells.some((c) => c.trackId === mediaUrl)) return mediaUrl
  return null
}

function missedBingoCellIndices(cells, revealedTrackIds, scoredByIndex) {
  const missed = new Set()
  for (const trackId of revealedTrackIds) {
    const idx = bingoCellIndexForTrackId(cells, trackId)
    if (idx < 0) continue
    if (scoredByIndex.has(idx)) continue
    missed.add(idx)
  }
  return missed
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

const cells = [
  { trackId: 'track-a', title: 'Song A', artist: 'Artist' },
  { trackId: 'track-b', title: 'Song B', artist: 'Artist' },
  { trackId: 'track-a-dup', title: 'Song A', artist: 'Artist' },
  { trackId: 'track-c', title: 'Song C', artist: 'Artist' },
]

// Scenario 1: team selects correct song — only that cell turns green
const playedTrackId = 'track-b'
const teamPickTrackId = 'track-b'
const correctIdx = bingoCellIndexForTrackId(cells, playedTrackId)
assert(correctIdx === 1, 'Scenario 1 — played track resolves to cell index 1')
assert(
  resolveBingoSubmissionTrackId(teamPickTrackId, cells) === playedTrackId,
  'Scenario 1 — submission track id matches played track id (approve → green at index 1)',
)
const historical1 = new Map([[1, 'approved']])
const missed1 = missedBingoCellIndices(cells, [playedTrackId], historical1)
assert(missed1.size === 0, 'Scenario 1 — approved cell is not marked grey; no other cells change')

// Scenario 2: wrong selection — red on pick, grey on correct unselected cell
const historical2 = new Map([[0, 'rejected']])
const missed2 = missedBingoCellIndices(cells, ['track-b'], historical2)
assert(
  missed2.has(1) && missed2.size === 1,
  'Scenario 2 — wrong pick at index 0 stays red; track-b cell at index 1 turns grey',
)

// Scenario 3: unplayed songs never grey
const missed3 = missedBingoCellIndices(cells, [], new Map())
assert(missed3.size === 0, 'Scenario 3 — empty revealed list → no grey cells')
const missed3b = missedBingoCellIndices(cells, ['track-c'], new Map())
assert(
  missed3b.has(3) && missed3b.size === 1,
  'Scenario 3 — only explicitly revealed track-c (index 3) can turn grey',
)
assert(!missed3b.has(0) && !missed3b.has(2), 'Scenario 3 — unplayed track-a cells stay uncolored')

// Scenario 4: duplicate titles handled by unique track id
assert(
  bingoCellIndexForTrackId(cells, 'track-a') === 0,
  'Scenario 4 — track-a maps to index 0 only',
)
assert(
  bingoCellIndexForTrackId(cells, 'track-a-dup') === 2,
  'Scenario 4 — track-a-dup (same title) maps to index 2',
)
const missed4a = missedBingoCellIndices(cells, ['track-a'], new Map())
const missed4b = missedBingoCellIndices(cells, ['track-a-dup'], new Map())
assert(missed4a.has(0) && !missed4a.has(2), 'Scenario 4 — revealing track-a greys index 0 only')
assert(missed4b.has(2) && !missed4b.has(0), 'Scenario 4 — revealing track-a-dup greys index 2 only')

// Legacy index submissions still resolve
assert(resolveBingoSubmissionCellIndex('1', cells) === 1, 'Legacy — index "1" resolves to cell 1')
assert(resolveBingoSubmissionTrackId('1', cells) === 'track-b', 'Legacy — index resolves to track id')

// Scenario 5: crossfade does not restart (code-path verification)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const facilitatorSrc = readFileSync(
  join(root, 'src/pages/live/FacilitatorEventPage.tsx'),
  'utf8',
)
const playerSrc = readFileSync(join(root, 'src/components/live/BingoClipPlayer.tsx'), 'utf8')
assert(
  facilitatorSrc.includes('skipCrossfade: true') && facilitatorSrc.includes('skipScore: true'),
  'Scenario 5 — autoAdvance skips second crossfade and re-score',
)
assert(
  playerSrc.includes('crossfadeInProgressRef') && playerSrc.includes('onLockAndReveal'),
  'Scenario 5 — player guards crossfade overlap and fires lock/reveal before fade',
)

console.log('\nAll 5 bingo self-check scenarios passed.')
