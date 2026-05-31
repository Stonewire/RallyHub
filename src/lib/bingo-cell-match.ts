import type { BingoCell } from '@/lib/bingo-engine'

/** Cell index on a team card for a track id (first match when duplicates exist). */
export function bingoCellIndexForTrackId(cells: BingoCell[], trackId: string): number {
  return cells.findIndex((c) => c.trackId === trackId)
}

/** Resolve a submission media_url to a cell index (supports legacy index or track id). */
export function resolveBingoSubmissionCellIndex(
  mediaUrl: string,
  cells: BingoCell[],
): number {
  const asNum = Number(mediaUrl)
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < cells.length) {
    return asNum
  }
  return cells.findIndex((c) => c.trackId === mediaUrl)
}

/** Resolve a submission media_url to the track id stored on the card. */
export function resolveBingoSubmissionTrackId(
  mediaUrl: string,
  cells: BingoCell[],
): string | null {
  const asNum = Number(mediaUrl)
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < cells.length) {
    return cells[asNum]?.trackId ?? null
  }
  if (cells.some((c) => c.trackId === mediaUrl)) return mediaUrl
  return null
}

/** Grey "missed" cells: one per revealed track, only the card cell for that track id. */
export function missedBingoCellIndices(
  cells: BingoCell[],
  revealedTrackIds: readonly string[],
  scoredByIndex: ReadonlyMap<number, 'approved' | 'rejected'>,
): Set<number> {
  const missed = new Set<number>()
  for (const trackId of revealedTrackIds) {
    const idx = bingoCellIndexForTrackId(cells, trackId)
    if (idx < 0) continue
    if (scoredByIndex.has(idx)) continue
    missed.add(idx)
  }
  return missed
}

export function parseRevealedTrackIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}
