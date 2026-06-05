export const ALL_BINGO_LINES: number[][] = [
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
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]

/** Rows + columns (the always-valid 10 lines). */
export const BINGO_ROW_COL_LINES: number[][] = ALL_BINGO_LINES.slice(0, 10)
/** The two diagonals. */
export const BINGO_DIAGONAL_LINES: number[][] = ALL_BINGO_LINES.slice(10, 12)

export const MIN_BINGO_LINES_REQUIRED = 1
export const MAX_BINGO_LINES_REQUIRED = 12

export function lineKey(line: number[]): string {
  return line.join(',')
}

export function defaultWinningLines(): number[][] {
  return [[0, 1, 2, 3, 4]]
}

export type BingoWinConfig = {
  mode: 'lines' | 'full_house'
  linesRequired: number
  includeDiagonals: boolean
}

function clampLinesRequired(n: number): number {
  if (!Number.isFinite(n)) return MIN_BINGO_LINES_REQUIRED
  return Math.min(MAX_BINGO_LINES_REQUIRED, Math.max(MIN_BINGO_LINES_REQUIRED, Math.round(n)))
}

/** Resolve the win condition from game config, with backward compatibility. */
export function resolveBingoWinConfig(config: {
  bingo_win_mode?: 'lines' | 'full_house'
  bingo_lines_required?: number
  bingo_include_diagonals?: boolean
  bingo_winning_lines?: number[][]
}): BingoWinConfig {
  if (config.bingo_win_mode === 'full_house') {
    return { mode: 'full_house', linesRequired: 1, includeDiagonals: false }
  }
  if (config.bingo_win_mode === 'lines') {
    return {
      mode: 'lines',
      linesRequired: clampLinesRequired(config.bingo_lines_required ?? 1),
      includeDiagonals: Boolean(config.bingo_include_diagonals),
    }
  }

  // Legacy: derive from the old explicit line picker. Treat as 1 line required;
  // enable diagonals if any old line was a diagonal.
  const legacy = config.bingo_winning_lines
  if (legacy?.length) {
    const diagKeys = new Set(BINGO_DIAGONAL_LINES.map(lineKey))
    const includeDiagonals = legacy.some((l) => diagKeys.has(lineKey(l)))
    return { mode: 'lines', linesRequired: 1, includeDiagonals }
  }

  return { mode: 'lines', linesRequired: 1, includeDiagonals: false }
}

/** Lines that count toward the requirement (rows + cols, plus diagonals if enabled). */
export function activeBingoLines(includeDiagonals: boolean): number[][] {
  return includeDiagonals ? ALL_BINGO_LINES : BINGO_ROW_COL_LINES
}

/** Number of fully-marked lines (rows + cols, plus diagonals if enabled). */
export function countCompleteBingoLines(
  markedIndices: Iterable<number>,
  includeDiagonals: boolean,
): number {
  const marked = new Set(markedIndices)
  return activeBingoLines(includeDiagonals).filter((line) => line.every((i) => marked.has(i)))
    .length
}

export function isBingoFullHouse(markedIndices: Iterable<number>): boolean {
  const marked = new Set(markedIndices)
  for (let i = 0; i < 25; i++) if (!marked.has(i)) return false
  return true
}

/** True when the marked cells satisfy the configured win condition. */
export function bingoWinAchieved(
  markedIndices: Iterable<number>,
  win: BingoWinConfig,
): boolean {
  if (win.mode === 'full_house') return isBingoFullHouse(markedIndices)
  return countCompleteBingoLines(markedIndices, win.includeDiagonals) >= win.linesRequired
}

/** Cells to visually highlight once the win condition is met (empty otherwise). */
export function bingoWinningHighlightCells(
  markedIndices: Iterable<number>,
  win: BingoWinConfig,
): Set<number> {
  const marked = new Set(markedIndices)
  if (win.mode === 'full_house') {
    return isBingoFullHouse(marked) ? new Set(Array.from({ length: 25 }, (_, i) => i)) : new Set()
  }
  // Use the exact same evaluation as the win check so the highlight and the
  // win-fire decision can never disagree.
  if (!bingoWinAchieved(marked, win)) return new Set()
  const complete = activeBingoLines(win.includeDiagonals).filter((line) =>
    line.every((i) => marked.has(i)),
  )
  const cells = new Set<number>()
  for (const line of complete) for (const i of line) cells.add(i)
  return cells
}

/** True when marked cells complete any allowed line. */
export function hasConfiguredBingoLine(
  markedIndices: Iterable<number>,
  allowedLines: number[][],
): boolean {
  const marked = new Set(markedIndices)
  if (marked.size < 5 || allowedLines.length === 0) return false
  return allowedLines.some((line) => line.length === 5 && line.every((i) => marked.has(i)))
}

export function cellsOnConfiguredBingoLine(
  markedIndices: Iterable<number>,
  allowedLines: number[][],
): Set<number> {
  const marked = new Set(markedIndices)
  for (const line of allowedLines) {
    if (line.length === 5 && line.every((i) => marked.has(i))) return new Set(line)
  }
  return new Set()
}

/** @deprecated use hasConfiguredBingoLine */
export function hasBingoLine(markedIndices: Iterable<number>): boolean {
  return hasConfiguredBingoLine(markedIndices, ALL_BINGO_LINES)
}

/** @deprecated use cellsOnConfiguredBingoLine */
export function cellsOnBingoLine(markedIndices: Iterable<number>): Set<number> {
  return cellsOnConfiguredBingoLine(markedIndices, ALL_BINGO_LINES)
}

export function approvedBingoCellIndices(
  submissions: {
    media_type: string | null
    media_url: string | null
    status: string
    game_id: string
  }[],
  gameId: string,
  cells?: { trackId: string }[],
): number[] {
  return submissions
    .filter(
      (s) =>
        s.media_type === 'bingo' &&
        s.game_id === gameId &&
        s.status === 'approved' &&
        s.media_url != null &&
        s.media_url !== 'claim',
    )
    .map((s) => {
      if (cells?.length) {
        const asNum = Number(s.media_url)
        if (!Number.isNaN(asNum) && asNum >= 0 && asNum < cells.length) return asNum
        return cells.findIndex((c) => c.trackId === s.media_url)
      }
      const n = Number(s.media_url)
      return Number.isNaN(n) ? -1 : n
    })
    .filter((n) => n >= 0 && n < 25)
}
