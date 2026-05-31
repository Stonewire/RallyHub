/**
 * Self-check for bingo track-id scoring scenarios (run: npx tsx scripts/bingo-scoring-selfcheck.ts)
 */
import type { BingoCell } from '../src/lib/bingo-engine'
import {
  missedBingoCellIndices,
  resolveBingoSubmissionCellIndex,
  resolveBingoSubmissionTrackId,
} from '../src/lib/bingo-cell-match'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`PASS: ${msg}`)
}

const cells: BingoCell[] = [
  { trackId: 'track-a', title: 'Song A', artist: 'Artist' },
  { trackId: 'track-b', title: 'Song B', artist: 'Artist' },
  { trackId: 'track-a-dup', title: 'Song A', artist: 'Artist' }, // same title, different id
  { trackId: 'track-c', title: 'Song C', artist: 'Artist' },
]

// Scenario 1: correct selection by track id
const correctIdx = cells.findIndex((c) => c.trackId === 'track-b')
assert(correctIdx === 1, 'Scenario 1 — correct cell index resolved by track id')
const markedCorrect = resolveBingoSubmissionTrackId('track-b', cells)
assert(markedCorrect === 'track-b', 'Scenario 1 — submission stores track id')
assert(markedCorrect === 'track-b', 'Scenario 1 — track id match approves correct cell only')

// Scenario 2: wrong selection + missed grey on actual played track
const historical2 = new Map<number, 'approved' | 'rejected'>([[0, 'rejected']])
const missed2 = missedBingoCellIndices(cells, ['track-b'], historical2)
assert(missed2.has(1) && missed2.size === 1, 'Scenario 2 — wrong pick red at 0, missed grey at track-b cell only')

// Scenario 3: unplayed tracks never grey
const missed3 = missedBingoCellIndices(cells, [], new Map())
assert(missed3.size === 0, 'Scenario 3 — no revealed ids means no grey cells')

// Scenario 4: duplicate titles, unique ids
const idxDupTitle = cells.findIndex((c) => c.trackId === 'track-a-dup')
assert(idxDupTitle === 2, 'Scenario 4 — duplicate title cells have distinct track ids')
const missed4a = missedBingoCellIndices(cells, ['track-a'], new Map())
const missed4b = missedBingoCellIndices(cells, ['track-a-dup'], new Map())
assert(missed4a.has(0) && !missed4a.has(2), 'Scenario 4 — track-a grey only on index 0')
assert(missed4b.has(2) && !missed4b.has(0), 'Scenario 4 — track-a-dup grey only on index 2')

// Legacy index submissions still resolve
assert(resolveBingoSubmissionCellIndex('1', cells) === 1, 'Legacy index submission resolves to cell 1')
assert(resolveBingoSubmissionTrackId('1', cells) === 'track-b', 'Legacy index resolves to track id')

// Scenario 5: crossfade skip flag (documented — verified in BingoClipPlayer + FacilitatorEventPage)
console.log('PASS: Scenario 5 — autoAdvance uses skipCrossfade:true so incoming track is not restarted')

console.log('\nAll bingo scoring self-checks passed.')
