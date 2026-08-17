// Offline auto-scoring for text games (OFFLINE-1 Stage 4).
//
// Reproduces the server's auto_approve_text_submission verdict on the device,
// using the answer keys downloaded on join (package.ts):
//   choose_answer -> the submitted option id equals the correct option id
//   type_text     -> sha256(btrim(input)) is in the shipped hash set
//
// The hash and trim MUST match the server byte-for-byte or an offline verdict
// would disagree with the authoritative server re-score on sync. The server uses
// Postgres btrim (spaces only) + encode(digest(..., 'sha256'), 'hex').

import type { OfflineAnswerKey } from './package'

/** Postgres btrim(text): strip leading/trailing SPACES only (not tabs/newlines),
 *  matching what the server hashed and what its trigger compares. */
export function btrimSpaces(value: string): string {
  return value.replace(/^ +/, '').replace(/ +$/, '')
}

/** Lowercase hex sha256, identical to encode(digest(x,'sha256'),'hex'). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Whether a text submission is correct offline, matching the server trigger.
 *  Returns false when there is no answer key (nothing to score against). */
export async function scoreOfflineText(
  mode: 'type_text' | 'choose_answer',
  key: OfflineAnswerKey | undefined,
  submitted: string,
): Promise<boolean> {
  if (!key) return false
  if (mode === 'choose_answer') {
    return Boolean(key.text_correct_answer_id) && submitted === key.text_correct_answer_id
  }
  const hashes = key.text_correct_answer_hashes ?? []
  if (hashes.length === 0) return false
  const submittedHash = await sha256Hex(btrimSpaces(submitted))
  return hashes.includes(submittedHash)
}

// ---- Puzzle mirrors ---------------------------------------------------------
// Exact ports of the server's validation, so an offline verdict can never
// disagree with the authoritative re-score on reconnect. Scoring FORMULAS
// (points) mirror puzzle_wordle_points / puzzle_matching_points /
// puzzle_crossword_points; validation mirrors puzzle_wordle_feedback and
// crossword_solved_word_ids byte for byte.

export type WordleMark = 'correct' | 'present' | 'absent'

/** Port of puzzle_wordle_feedback: first pass marks exact positions, second
 *  pass marks 'present' consuming each answer letter at most once. */
export function wordleFeedbackLocal(answer: string, guess: string): WordleMark[] {
  const a = [...answer.toLowerCase()]
  const g = [...guess.toLowerCase()]
  const used = a.map(() => false)
  const feedback: WordleMark[] = g.map(() => 'absent')
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      feedback[i] = 'correct'
      used[i] = true
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (feedback[i] === 'correct') continue
    for (let j = 0; j < a.length; j++) {
      if (!used[j] && g[i] === a[j]) {
        feedback[i] = 'present'
        used[j] = true
        break
      }
    }
  }
  return feedback
}

/** Port of puzzle_wordle_points: 10% off per extra attempt, floor 10%. */
export function wordlePointsLocal(maxPoints: number, attempts: number): number {
  const max = Math.max(maxPoints, 0)
  return Math.max(
    Math.round(max * Math.pow(0.9, Math.max(attempts, 1) - 1)),
    Math.ceil(max * 0.1),
  )
}

/** Port of puzzle_matching_points: 5% off per wrong match, floor 25%. */
export function matchingPointsLocal(maxPoints: number, wrongMatches: number): number {
  const max = Math.max(maxPoints, 0)
  return Math.max(
    Math.round(max * (1 - Math.max(wrongMatches, 0) * 0.05)),
    Math.ceil(max * 0.25),
  )
}

/** Port of puzzle_crossword_points: -5% per 30s block over 5 minutes, -10% per
 *  hint, floor 10%. */
export function crosswordPointsLocal(
  maxPoints: number,
  solveSeconds: number,
  hintsUsed: number,
): number {
  const max = Math.max(maxPoints, 0)
  const over = Math.max(0, Math.max(solveSeconds, 0) - 300)
  const factor = Math.max(0.1, 1 - 0.05 * Math.ceil(over / 30) - 0.1 * Math.max(0, hintsUsed))
  return Math.max(Math.round(max * factor), Math.ceil(max * 0.1))
}

export type CrosswordWord = {
  id: string
  answer: string
  row: number
  col: number
  direction: 'across' | 'down'
}

/** Port of crossword_solved_word_ids over a cells map keyed "row-col". */
export function crosswordSolvedIdsLocal(
  words: CrosswordWord[],
  cells: Record<string, string>,
): string[] {
  const ids: string[] = []
  for (const word of words) {
    const answer = (word.answer ?? '').toLowerCase()
    let ok = answer.length > 0
    for (let i = 0; i < answer.length; i++) {
      const key =
        word.direction === 'down' ? `${word.row + i}-${word.col}` : `${word.row}-${word.col + i}`
      if ((cells[key] ?? '').toLowerCase() !== answer[i]) ok = false
    }
    if (ok) ids.push(word.id)
  }
  return ids
}
