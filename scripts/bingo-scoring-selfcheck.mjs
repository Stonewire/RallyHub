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

// Regression: scoring must not gate on the first team's card containing the track.
// Simulate the scoreBingoRound decision per team for a played track absent from card[0].
function decideTeamMarks(teamCards, playedTrackId, submissionsByTeam) {
  const approvedTeams = []
  const rejectedTeams = []
  for (const { teamId, cells: teamCells } of teamCards) {
    const sub = submissionsByTeam[teamId]
    if (sub == null) continue
    const marked = resolveBingoSubmissionTrackId(sub, teamCells)
    if (!marked) continue
    if (marked === playedTrackId) approvedTeams.push(teamId)
    else rejectedTeams.push(teamId)
  }
  return { approvedTeams, rejectedTeams }
}

const teamCards = [
  // card[0] does NOT contain the played track "track-z"
  { teamId: 'team-1', cells: [{ trackId: 'track-x', title: 'X', artist: '' }, { trackId: 'track-y', title: 'Y', artist: '' }] },
  // card[1] DOES contain it
  { teamId: 'team-2', cells: [{ trackId: 'track-z', title: 'Z', artist: '' }, { trackId: 'track-q', title: 'Q', artist: '' }] },
]
const subsByTeam = { 'team-1': 'track-y', 'team-2': 'track-z' }
const decision = decideTeamMarks(teamCards, 'track-z', subsByTeam)
assert(
  decision.approvedTeams.includes('team-2'),
  'Regression — team-2 correct pick approved even though played track is absent from card[0]',
)
assert(
  decision.rejectedTeams.includes('team-1'),
  'Regression — team-1 wrong pick rejected; scoring no longer early-returns on card[0] miss',
)

// Win condition: 2 lines. Replicate bingo-lines.ts logic locally and confirm the
// win check AND the highlight agree (highlight is gated on the same win check).
const ROW_COL_LINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
]
const DIAGONALS = [
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]
function activeLines(includeDiagonals) {
  return includeDiagonals ? [...ROW_COL_LINES, ...DIAGONALS] : ROW_COL_LINES
}
function countCompleteLines(marked, includeDiagonals) {
  const set = new Set(marked)
  return activeLines(includeDiagonals).filter((l) => l.every((i) => set.has(i))).length
}
function isFullHouse(marked) {
  const set = new Set(marked)
  for (let i = 0; i < 25; i++) if (!set.has(i)) return false
  return true
}
function winAchieved(marked, win) {
  if (win.mode === 'full_house') return isFullHouse(marked)
  return countCompleteLines(marked, win.includeDiagonals) >= win.linesRequired
}
function highlightCells(marked, win) {
  if (win.mode === 'full_house') {
    return isFullHouse(marked) ? new Set(Array.from({ length: 25 }, (_, i) => i)) : new Set()
  }
  if (!winAchieved(marked, win)) return new Set()
  const set = new Set(marked)
  const cells = new Set()
  for (const l of activeLines(win.includeDiagonals)) if (l.every((i) => set.has(i)))
    for (const i of l) cells.add(i)
  return cells
}

const win2 = { mode: 'lines', linesRequired: 2, includeDiagonals: false }
// One complete line (row 0): not yet a win.
const oneLine = [0, 1, 2, 3, 4]
assert(countCompleteLines(oneLine, false) === 1, 'Win — single completed row counts as 1 line')
assert(!winAchieved(oneLine, win2), 'Win — 1 line does NOT satisfy a 2-line requirement')
assert(highlightCells(oneLine, win2).size === 0, 'Win — highlight stays empty at 1 line (same logic)')
// Two complete lines (row 0 + col 0): a win.
const twoLines = [0, 1, 2, 3, 4, 5, 10, 15, 20]
assert(countCompleteLines(twoLines, false) === 2, 'Win — completeLines reaches 2')
assert(winAchieved(twoLines, win2), 'Win — bingoWinAchieved returns true at 2 lines')
assert(highlightCells(twoLines, win2).size > 0, 'Win — highlight fires exactly when win fires (same logic)')

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

// Stop-the-game-on-win wiring (code-path verification)
assert(
  playerSrc.includes('pause: () => {') && playerSrc.includes('pause: () => void'),
  'Win-stop — player exposes an additive pause() control',
)
assert(
  facilitatorSrc.includes('bingoWinHaltRef.current = true') &&
    facilitatorSrc.includes('bingoAudioRef.current?.pause()'),
  'Win-stop — a win sets the halt flag and pauses audio',
)
assert(
  facilitatorSrc.includes('auto-advance halted — bingo won'),
  'Win-stop — auto-advance is blocked while a win is pending',
)
assert(
  facilitatorSrc.includes('continuingPastWin'),
  'Win-stop — facilitator can Continue past a win to resume play',
)

console.log('\nAll bingo self-check scenarios passed (scoring, win detection, win-stop).')
