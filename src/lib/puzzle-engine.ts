import type {
  CrosswordClue,
  CrosswordLayout,
  GameConfig,
  PuzzleCrosswordWord,
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
  puzzleType: 'wordle' | 'matching' | 'crossword'
  attempts: number
  wrongMatches: number
  guesses: PuzzleGuess[]
  matchedLeftIds: string[]
  matchedRightIds: string[]
  filledCells: Record<string, string>
  failedFullChecks: number
  solveSeconds: number | null
  completed: boolean
  pointsAwarded: number | null
  lastMatchCorrect?: boolean
  lastCheckCorrect?: boolean
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
  const type =
    raw.puzzleType === 'matching' ? 'matching'
    : raw.puzzleType === 'crossword' ? 'crossword'
    : 'wordle'
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
    filledCells:
      raw.filledCells && typeof raw.filledCells === 'object' && !Array.isArray(raw.filledCells)
        ? Object.fromEntries(
            Object.entries(raw.filledCells as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {},
    failedFullChecks: typeof raw.failedFullChecks === 'number' ? raw.failedFullChecks : 0,
    solveSeconds: typeof raw.solveSeconds === 'number' ? raw.solveSeconds : null,
    completed: raw.completed === true,
    pointsAwarded: typeof raw.pointsAwarded === 'number' ? raw.pointsAwarded : null,
    ...(typeof raw.lastMatchCorrect === 'boolean'
      ? { lastMatchCorrect: raw.lastMatchCorrect }
      : {}),
    ...(typeof raw.lastCheckCorrect === 'boolean'
      ? { lastCheckCorrect: raw.lastCheckCorrect }
      : {}),
  }
}

export function validatePuzzleConfig(config: GameConfig): string | null {
  const type = puzzleType(config)
  if (type === 'crossword') {
    const words = config.puzzle_crossword_words ?? []
    const layoutError = validateCrosswordWords(words)
    if (layoutError) return layoutError
    if (!config.puzzle_crossword_layout) {
      return 'Crossword layout is missing. Re-open the editor and save again.'
    }
    return null
  }
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

export const CROSSWORD_SIZE = 5

export function crosswordWordCells(
  word: PuzzleCrosswordWord,
): { row: number; col: number }[] {
  return Array.from(Array.from(word.answer).keys()).map((i) => ({
    row: word.direction === 'down' ? word.row + i : word.row,
    col: word.direction === 'across' ? word.col + i : word.col,
  }))
}

export function crosswordCellLetters(words: PuzzleCrosswordWord[]): {
  letters: Map<string, string>
  conflicts: Set<string>
} {
  const letters = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const word of words) {
    const chars = Array.from(word.answer.toLocaleLowerCase())
    crosswordWordCells(word).forEach(({ row, col }, i) => {
      const key = `${row}-${col}`
      const existing = letters.get(key)
      if (existing !== undefined && existing !== chars[i]) conflicts.add(key)
      letters.set(key, chars[i])
    })
  }
  return { letters, conflicts }
}

export function validateCrosswordWords(words: PuzzleCrosswordWord[]): string | null {
  if (words.length < 2) return 'Add at least 2 words.'
  for (const word of words) {
    const length = Array.from(word.answer).length
    if (length < 2 || length > CROSSWORD_SIZE) {
      return `"${word.answer}" needs 2 to ${CROSSWORD_SIZE} letters.`
    }
    if (!/^\p{L}+$/u.test(word.answer)) return `"${word.answer}" can contain letters only.`
    const cells = crosswordWordCells(word)
    const last = cells[cells.length - 1]
    if (
      word.row < 0 || word.col < 0 ||
      last.row >= CROSSWORD_SIZE || last.col >= CROSSWORD_SIZE
    ) {
      return `"${word.answer}" does not fit on the grid from that cell.`
    }
    if (!word.clue.trim()) return `"${word.answer}" needs a clue.`
  }
  const { conflicts } = crosswordCellLetters(words)
  if (conflicts.size > 0) return 'Overlapping words must share the same letter.'

  // Connectivity: every word must share a cell with another word, and the
  // whole set must form one connected group.
  const cellOwners = new Map<string, number[]>()
  words.forEach((word, index) => {
    for (const { row, col } of crosswordWordCells(word)) {
      const key = `${row}-${col}`
      cellOwners.set(key, [...(cellOwners.get(key) ?? []), index])
    }
  })
  const adjacent = words.map(() => new Set<number>())
  for (const owners of cellOwners.values()) {
    for (const a of owners) for (const b of owners) if (a !== b) adjacent[a].add(b)
  }
  const seen = new Set<number>([0])
  const queue = [0]
  while (queue.length > 0) {
    const current = queue.pop() as number
    for (const next of adjacent[current]) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  if (seen.size !== words.length) return 'Every word must cross at least one other word.'
  return null
}

export function buildCrosswordLayout(words: PuzzleCrosswordWord[]): CrosswordLayout {
  const { letters } = crosswordCellLetters(words)
  const cells = [...letters.keys()]
    .map((key) => {
      const [row, col] = key.split('-').map(Number)
      return { row, col }
    })
    .sort((a, b) => a.row - b.row || a.col - b.col)
  const startNumbers = new Map<string, number>()
  let nextNumber = 1
  const clues: CrosswordClue[] = []
  const sortedWords = [...words].sort(
    (a, b) => a.row - b.row || a.col - b.col || (a.direction === 'across' ? -1 : 1),
  )
  for (const word of sortedWords) {
    const startKey = `${word.row}-${word.col}`
    let number = startNumbers.get(startKey)
    if (number === undefined) {
      number = nextNumber
      nextNumber += 1
      startNumbers.set(startKey, number)
    }
    clues.push({
      id: word.id,
      number,
      direction: word.direction,
      row: word.row,
      col: word.col,
      length: Array.from(word.answer).length,
      clue: word.clue,
    })
  }
  return { cells, clues }
}

export function crosswordScore(maxPoints: number, solveSeconds: number): number {
  const max = Math.max(0, Math.round(maxPoints))
  const extraMinutes = Math.max(0, Math.floor((Math.max(0, solveSeconds) - 120) / 60))
  return Math.max(Math.round(max * 0.9 ** extraMinutes), Math.ceil(max * 0.25))
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
