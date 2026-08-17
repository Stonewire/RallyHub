// Local puzzle play while offline (OFFLINE-1 Stage 4).
//
// When the device is offline and the downloaded answer key for a puzzle is on
// hand, the players drive PuzzleProgress from these mirrors instead of the
// per-interaction RPCs, then queue ONE 'puzzle-result' outbox item on
// completion for the server to replay and re-score authoritatively. Validation
// and points go through the tested server-parity ports in scoring.ts, so a
// local verdict can never disagree with the server's re-score on reconnect.
// In-flight state persists in IndexedDB so a reload mid-puzzle resumes.

import type { PuzzleProgress } from '@/lib/puzzle-engine'
import type { PuzzleMatchingPair } from '@/types/game-config'

import { idbGet, idbSet } from './idb'
import type { OfflineAnswerKey } from './package'
import {
  crosswordPointsLocal,
  crosswordSolvedIdsLocal,
  matchingPointsLocal,
  wordleFeedbackLocal,
  wordlePointsLocal,
  type CrosswordWord,
} from './scoring'

const localKey = (eventId: string, teamId: string, gameId: string) =>
  `puzzle:${eventId}:${teamId}:${gameId}`

type StoredLocalPuzzle = { progress: PuzzleProgress; savedAt: string }

export async function loadLocalPuzzleProgress(
  eventId: string,
  teamId: string,
  gameId: string,
): Promise<PuzzleProgress | null> {
  const rec = await idbGet<StoredLocalPuzzle>('content', localKey(eventId, teamId, gameId))
  return rec?.progress ?? null
}

/** Fire-and-forget: a storage failure only costs resume-after-reload, never
 *  the play in front of the team. */
export function saveLocalPuzzleProgress(
  eventId: string,
  teamId: string,
  gameId: string,
  progress: PuzzleProgress,
): void {
  void idbSet('content', localKey(eventId, teamId, gameId), {
    progress,
    savedAt: new Date().toISOString(),
  } satisfies StoredLocalPuzzle).catch(() => undefined)
}

/** startedAt is stamped the moment local play begins; for crosswords it is the
 *  solve-timer origin (the server uses the progress row's created_at). */
export function freshLocalPuzzleProgress(type: PuzzleProgress['puzzleType']): PuzzleProgress {
  return {
    puzzleType: type,
    attempts: 0,
    wrongMatches: 0,
    guesses: [],
    matchedLeftIds: [],
    matchedRightIds: [],
    filledCells: {},
    revealedCells: {},
    hintsUsed: 0,
    solvedWordIds: [],
    startedAt: new Date().toISOString(),
    failedFullChecks: 0,
    solveSeconds: null,
    completed: false,
    pointsAwarded: null,
  }
}

// ---- Answer-key readers -----------------------------------------------------
// The package stores puzzle keys as opaque JSON; a malformed key (partial
// download, an older package format) makes the game not offline-capable rather
// than crashing play, so each reader returns null unless the whole shape holds.

export function wordleAnswerFromKey(key: OfflineAnswerKey | null | undefined): string | null {
  const answer = key?.puzzle_wordle_answer
  return typeof answer === 'string' && answer.trim().length > 0 ? answer.trim() : null
}

export function matchingPairsFromKey(
  key: OfflineAnswerKey | null | undefined,
): PuzzleMatchingPair[] | null {
  const raw = key?.puzzle_matching_pairs
  if (!Array.isArray(raw) || raw.length === 0) return null
  const pairs: PuzzleMatchingPair[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const pair = entry as Record<string, unknown>
    if (
      typeof pair.id !== 'string' ||
      typeof pair.leftId !== 'string' ||
      typeof pair.rightId !== 'string'
    ) {
      return null
    }
    pairs.push({
      id: pair.id,
      leftId: pair.leftId,
      rightId: pair.rightId,
      left: typeof pair.left === 'string' ? pair.left : '',
      right: typeof pair.right === 'string' ? pair.right : '',
    })
  }
  return pairs
}

export function crosswordWordsFromKey(
  key: OfflineAnswerKey | null | undefined,
): CrosswordWord[] | null {
  const raw = key?.puzzle_crossword_words
  if (!Array.isArray(raw) || raw.length === 0) return null
  const words: CrosswordWord[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const word = entry as Record<string, unknown>
    if (
      typeof word.id !== 'string' ||
      typeof word.answer !== 'string' ||
      typeof word.row !== 'number' ||
      typeof word.col !== 'number' ||
      (word.direction !== 'across' && word.direction !== 'down')
    ) {
      return null
    }
    words.push({
      id: word.id,
      answer: word.answer,
      row: word.row,
      col: word.col,
      direction: word.direction,
    })
  }
  return words
}

// ---- Local drivers ----------------------------------------------------------
// Each one takes the current PuzzleProgress and returns the next, in exactly
// the shape the server RPCs would have returned, so the player components
// render local play with zero changes.

/** Mirror of submit_wordle_guess's progress step. Throws when the guess cannot
 *  be scored (length mismatch with the answer), like the server rejects it. */
export function applyLocalWordleGuess(
  progress: PuzzleProgress,
  answer: string,
  guess: string,
  maxPoints: number,
): PuzzleProgress {
  if (progress.completed) return progress
  const trimmed = guess.trim()
  if (Array.from(trimmed).length !== Array.from(answer).length) {
    throw new Error('Your guess does not have the right number of letters.')
  }
  const feedback = wordleFeedbackLocal(answer, trimmed)
  const attempts = progress.attempts + 1
  const completed = feedback.every((mark) => mark === 'correct')
  return {
    ...progress,
    attempts,
    guesses: [...progress.guesses, { word: trimmed, feedback }],
    completed,
    pointsAwarded: completed ? wordlePointsLocal(maxPoints, attempts) : progress.pointsAwarded,
  }
}

/** Mirror of submit_matching_pair's progress step. matchedLeftIds/RightIds
 *  stand in for the server's matched_pair_ids: every correct match adds
 *  exactly one id to each, so their length is the matched-pair count. */
export function applyLocalMatch(
  progress: PuzzleProgress,
  pairs: PuzzleMatchingPair[],
  leftId: string,
  rightId: string,
  maxPoints: number,
): PuzzleProgress {
  if (progress.completed) return progress
  // Re-submitting an already matched side is a counted-nowhere no-op online.
  if (progress.matchedLeftIds.includes(leftId) || progress.matchedRightIds.includes(rightId)) {
    return { ...progress, lastMatchCorrect: true }
  }
  const leftPair = pairs.find((pair) => pair.leftId === leftId)
  const rightPair = pairs.find((pair) => pair.rightId === rightId)
  if (!leftPair || !rightPair) {
    throw new Error('That matching option is no longer available.')
  }
  const correct = leftPair.id === rightPair.id
  const attempts = progress.attempts + 1
  const wrongMatches = correct ? progress.wrongMatches : progress.wrongMatches + 1
  const matchedLeftIds = correct
    ? [...progress.matchedLeftIds, leftPair.leftId]
    : progress.matchedLeftIds
  const matchedRightIds = correct
    ? [...progress.matchedRightIds, leftPair.rightId]
    : progress.matchedRightIds
  const completed = matchedLeftIds.length === pairs.length
  return {
    ...progress,
    attempts,
    wrongMatches,
    matchedLeftIds,
    matchedRightIds,
    completed,
    pointsAwarded: completed ? matchingPointsLocal(maxPoints, wrongMatches) : progress.pointsAwarded,
    lastMatchCorrect: correct,
  }
}

/** Mirror of validate_crossword_grid: save the fill, recompute every solved
 *  word from the whole grid, and on a full solve complete with time + hint
 *  scoring. solveSeconds counts from the locally captured startedAt. */
export function applyLocalCrosswordCheck(
  progress: PuzzleProgress,
  words: CrosswordWord[],
  cells: Record<string, string>,
  maxPoints: number,
  nowMs: number = Date.now(),
): PuzzleProgress {
  if (progress.completed) return progress
  const filledCells = { ...cells }
  const solvedWordIds = crosswordSolvedIdsLocal(words, filledCells)
  if (words.length === 0 || solvedWordIds.length < words.length) {
    return { ...progress, filledCells, solvedWordIds }
  }
  const startedMs = progress.startedAt ? Date.parse(progress.startedAt) : NaN
  const solveSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0
  return {
    ...progress,
    filledCells,
    solvedWordIds,
    completed: true,
    solveSeconds,
    pointsAwarded: crosswordPointsLocal(maxPoints, solveSeconds, progress.hintsUsed),
  }
}

/** Mirror of use_crossword_hint: for EACH unsolved word, reveal its first cell
 *  whose letter is wrong or empty and not already granted this pass (a shared
 *  crossing cell is granted once), then merge the reveals into both maps.
 *  Hints cap at 3 and count even when nothing was left to reveal, exactly as
 *  the server counts them. */
export function applyLocalCrosswordHint(
  progress: PuzzleProgress,
  words: CrosswordWord[],
  cells: Record<string, string>,
): PuzzleProgress {
  if (progress.completed || progress.hintsUsed >= 3) return progress
  const filled = { ...cells }
  const solved = new Set(crosswordSolvedIdsLocal(words, filled))
  const reveals: Record<string, string> = {}
  for (const word of words) {
    if (solved.has(word.id)) continue
    const answer = (word.answer ?? '').toLowerCase()
    for (let i = 0; i < answer.length; i++) {
      const key =
        word.direction === 'down' ? `${word.row + i}-${word.col}` : `${word.row}-${word.col + i}`
      if ((filled[key] ?? '').toLowerCase() !== answer[i] && !(key in reveals)) {
        reveals[key] = answer[i].toUpperCase()
        break
      }
    }
  }
  const filledCells = { ...filled, ...reveals }
  return {
    ...progress,
    hintsUsed: progress.hintsUsed + 1,
    revealedCells: { ...progress.revealedCells, ...reveals },
    filledCells,
    // The server payload recomputes solved words from the merged fill on every
    // read; a hint can finish a word's last letter, and it must go green now.
    solvedWordIds: crosswordSolvedIdsLocal(words, filledCells),
  }
}
