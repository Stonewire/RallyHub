/** Pure bingo run planner: per-team cards + unique play order (no repeats). */

export type BingoTrack = {
  id: string
  title: string
  artist: string
}

export type BingoTeam = {
  id: string
  name: string | null
}

export type BingoCell = {
  trackId: string
  title: string
  artist: string
}

const GRID = 25

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pick25(tracks: BingoTrack[], seed: number): BingoCell[] {
  const pool = shuffleWithSeed(tracks, seed)
  const ids = new Set<string>()
  const cells: BingoCell[] = []

  for (const t of pool) {
    if (cells.length >= GRID) break
    if (ids.has(t.id) && pool.length >= GRID) continue
    cells.push({ trackId: t.id, title: t.title, artist: t.artist })
    ids.add(t.id)
  }
  while (cells.length < GRID) {
    const t = pool[cells.length % pool.length]
    cells.push({ trackId: t.id, title: t.title, artist: t.artist })
  }
  return shuffleWithSeed(cells, seed + 1)
}

/** Shuffled list of every track id once (no repeats). */
export function buildUniquePlayOrder(trackIds: string[], seed: number): string[] {
  return shuffleWithSeed([...trackIds], seed)
}

export function generateBingoRun(opts: {
  tracks: BingoTrack[]
  teams: BingoTeam[]
  gameId: string
  activationSeed: string
}): {
  cardsByTeamId: Record<string, BingoCell[]>
  playOrder: string[]
} {
  const { tracks, teams, gameId, activationSeed } = opts

  const active = teams.filter((t) => t.name?.trim())
  if (active.length === 0) throw new Error('No active teams for bingo')
  if (tracks.length < 5) throw new Error('Need at least 5 tracks for bingo')

  const seed = hashSeed(activationSeed)
  const poolIds = tracks.map((t) => t.id)
  const playOrder = buildUniquePlayOrder(poolIds, seed + 99)

  const cardsByTeamId: Record<string, BingoCell[]> = {}
  for (const team of active) {
    let card = pick25(tracks, hashSeed(`${team.id}:${gameId}`))
    let attempts = 0
    while (attempts < 8) {
      const duplicate = Object.values(cardsByTeamId).some(
        (other) =>
          JSON.stringify(other.map((c) => c.trackId)) ===
          JSON.stringify(card.map((c) => c.trackId)),
      )
      if (!duplicate) break
      card = pick25(
        tracks,
        hashSeed(`${team.id}:${gameId}:${activationSeed}:${String(attempts)}`),
      )
      attempts++
    }
    cardsByTeamId[team.id] = card
  }

  return { cardsByTeamId, playOrder }
}

/** Two-line label for compact bingo cells. */
export function bingoCellDisplay(cells: BingoCell[]): { title: string; artist: string }[] {
  return cells.map((c) => ({ title: c.title, artist: c.artist }))
}

export function bingoCellLabels(cells: BingoCell[]): string[] {
  return cells.map((c) => c.title)
}

export function trackForPlayIndex(
  playOrder: string[],
  index: number,
  tracks: BingoTrack[],
): BingoTrack | null {
  const id = playOrder[index]
  if (!id) return null
  return tracks.find((t) => t.id === id) ?? null
}
