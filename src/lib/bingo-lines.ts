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

export function lineKey(line: number[]): string {
  return line.join(',')
}

export function defaultWinningLines(): number[][] {
  return [[0, 1, 2, 3, 4]]
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
