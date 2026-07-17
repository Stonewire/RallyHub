import type {
  GameConfig,
  PuzzleMatchingItem,
  PuzzleMatchingPair,
  PuzzleType,
} from '@/types/game-config'
import type { Json } from '@/types/json'
import type { Tables } from '@/types/helpers'

export type WordleCellState = 'correct' | 'present' | 'absent'

export type PuzzleGuess = {
  word: string
  feedback: WordleCellState[]
}

export type PuzzleProgress = {
  puzzleType: 'wordle' | 'matching'
  attempts: number
  wrongMatches: number
  guesses: PuzzleGuess[]
  matchedLeftIds: string[]
  matchedRightIds: string[]
  completed: boolean
  pointsAwarded: number | null
  lastMatchCorrect?: boolean
}

export function isPuzzleGame(
  game: Pick<Tables<'games'>, 'type'> | null | undefined,
): boolean {
  return game?.type === 'puzzle'
}

export function puzzleType(config: GameConfig | Json | null | undefined): PuzzleType {
  return ((config ?? {}) as GameConfig).puzzle_type ?? 'wordle'
}

export function wordleScore(maxPoints: number, attempts: number): number {
  const max = Math.max(0, Math.round(maxPoints))
  return Math.max(
    Math.round(max * 0.9 ** (Math.max(1, attempts) - 1)),
    Math.ceil(max * 0.1),
  )
}

export function matchingScore(maxPoints: number, wrongMatches: number): number {
  const max = Math.max(0, Math.round(maxPoints))
  return Math.max(
    Math.round(max * (1 - Math.max(0, wrongMatches) * 0.05)),
    Math.ceil(max * 0.25),
  )
}

/** Wordle duplicate-letter rules: exact matches consume letters before presents. */
export function wordleFeedback(answer: string, guess: string): WordleCellState[] {
  const answerChars = Array.from(answer.toLocaleLowerCase())
  const guessChars = Array.from(guess.toLocaleLowerCase())
  if (answerChars.length !== guessChars.length) {
    throw new Error('Guess length does not match the answer.')
  }
  const used = answerChars.map(() => false)
  const result: WordleCellState[] = answerChars.map(() => 'absent')
  for (let i = 0; i < answerChars.length; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = 'correct'
      used[i] = true
    }
  }
  for (let i = 0; i < guessChars.length; i++) {
    if (result[i] === 'correct') continue
    const match = answerChars.findIndex((letter, index) => !used[index] && letter === guessChars[i])
    if (match >= 0) {
      result[i] = 'present'
      used[match] = true
    }
  }
  return result
}

export function parsePuzzleProgress(value: Json | null | undefined): PuzzleProgress {
  const raw = (value ?? {}) as Record<string, unknown>
  const type = raw.puzzleType === 'matching' ? 'matching' : 'wordle'
  const guesses = Array.isArray(raw.guesses)
    ? raw.guesses.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const record = entry as Record<string, unknown>
        if (typeof record.word !== 'string' || !Array.isArray(record.feedback)) return []
        const feedback = record.feedback.filter(
          (state): state is WordleCellState =>
            state === 'correct' || state === 'present' || state === 'absent',
        )
        return feedback.length === Array.from(record.word).length
          ? [{ word: record.word, feedback }]
          : []
      })
    : []
  const strings = (input: unknown) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : []
  return {
    puzzleType: type,
    attempts: typeof raw.attempts === 'number' ? raw.attempts : 0,
    wrongMatches: typeof raw.wrongMatches === 'number' ? raw.wrongMatches : 0,
    guesses,
    matchedLeftIds: strings(raw.matchedLeftIds),
    matchedRightIds: strings(raw.matchedRightIds),
    completed: raw.completed === true,
    pointsAwarded: typeof raw.pointsAwarded === 'number' ? raw.pointsAwarded : null,
    ...(typeof raw.lastMatchCorrect === 'boolean'
      ? { lastMatchCorrect: raw.lastMatchCorrect }
      : {}),
  }
}

export function validatePuzzleConfig(config: GameConfig): string | null {
  const type = puzzleType(config)
  if (type === 'crossword') return 'Crossword is coming soon and cannot be saved yet.'
  if (type === 'wordle') {
    const answer = (config.puzzle_wordle_answer ?? '').trim()
    const length = Array.from(answer).length
    if (length < 3 || length > 12) return 'Wordle answers need between 3 and 12 letters.'
    if (!/^\p{L}+$/u.test(answer)) return 'Wordle answers can contain letters only.'
    return null
  }
  const pairs = config.puzzle_matching_pairs ?? []
  if (pairs.length < 2 || pairs.length > 12) return 'Matching puzzles need between 2 and 12 pairs.'
  if (pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) {
    return 'Every matching pair needs text on both sides.'
  }
  const left = pairs.map((pair) => pair.left.trim().toLocaleLowerCase())
  const right = pairs.map((pair) => pair.right.trim().toLocaleLowerCase())
  if (new Set(left).size !== left.length || new Set(right).size !== right.length) {
    return 'Matching values must be unique within each column.'
  }
  if (pairs.some((pair) => !pair.id || !pair.leftId || !pair.rightId)) {
    return 'A matching pair is missing its internal ID. Remove it and add it again.'
  }
  return null
}

function stringHash(value: string): number {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function seededPuzzleShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items]
  let state = stringHash(seed) || 1
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function newMatchingPair(left = '', right = ''): PuzzleMatchingPair {
  return {
    id: crypto.randomUUID(),
    leftId: crypto.randomUUID(),
    rightId: crypto.randomUUID(),
    left,
    right,
  }
}

export function liveMatchingItems(config: GameConfig): {
  left: PuzzleMatchingItem[]
  right: PuzzleMatchingItem[]
} {
  return {
    left: config.puzzle_matching_left_items ?? [],
    right: config.puzzle_matching_right_items ?? [],
  }
}
