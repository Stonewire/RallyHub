const LINES: number[][] = [
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

/** True when five marked cells form any row, column, or diagonal on a 5×5 card. */
export function hasBingoLine(markedIndices: Iterable<number>): boolean {
  const marked = new Set(markedIndices)
  if (marked.size < 5) return false
  return LINES.some((line) => line.every((i) => marked.has(i)))
}

/** Indices that belong to the first completed line, if any. */
export function cellsOnBingoLine(markedIndices: Iterable<number>): Set<number> {
  const marked = new Set(markedIndices)
  for (const line of LINES) {
    if (line.every((i) => marked.has(i))) return new Set(line)
  }
  return new Set()
}

export function approvedBingoCellIndices(
  submissions: { media_type: string | null; media_url: string | null; status: string; game_id: string }[],
  gameId: string,
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
    .map((s) => Number(s.media_url))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n < 25)
}
