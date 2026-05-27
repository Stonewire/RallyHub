/** Pure bingo run planner: secret winner, per-team cards, scripted play order. */

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

function pick25(tracks: BingoTrack[], seed: number, winTrackIds?: string[]): BingoCell[] {
  const pool = shuffleWithSeed(tracks, seed)
  const ids = new Set<string>()
  const cells: BingoCell[] = []

  if (winTrackIds && winTrackIds.length === 5) {
    for (const tid of winTrackIds) {
      const t = tracks.find((x) => x.id === tid)
      if (t) cells.push({ trackId: t.id, title: t.title, artist: t.artist })
      ids.add(tid)
    }
    for (const t of pool) {
      if (cells.length >= GRID) break
      if (ids.has(t.id)) continue
      cells.push({ trackId: t.id, title: t.title, artist: t.artist })
      ids.add(t.id)
    }
    while (cells.length < GRID) {
      const t = pool[cells.length % pool.length]
      cells.push({ trackId: t.id, title: t.title, artist: t.artist })
    }
    const tail = cells.slice(5)
    const head = cells.slice(0, 5)
    return [...head, ...shuffleWithSeed(tail, seed + 1)]
  }

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
  return shuffleWithSeed(cells, seed)
}

function buildPlayOrder(
  winTrackIds: string[],
  poolIds: string[],
  targetLength: number,
  seed: number,
): string[] {
  const fillers = shuffleWithSeed(
    poolIds.filter((id) => !winTrackIds.includes(id)),
    seed,
  )
  const order: string[] = []
  let fi = 0
  const gap = Math.max(2, Math.floor((targetLength - winTrackIds.length) / winTrackIds.length))

  for (let i = 0; i < winTrackIds.length; i++) {
    for (let g = 0; g < gap && order.length < targetLength - winTrackIds.length + i; g++) {
      if (fillers.length > 0) {
        order.push(fillers[fi % fillers.length])
        fi++
      }
    }
    order.push(winTrackIds[i])
  }
  while (order.length < targetLength && fillers.length > 0) {
    order.push(fillers[fi % fillers.length])
    fi++
  }
  return order.slice(0, targetLength)
}

export function generateBingoRun(opts: {
  tracks: BingoTrack[]
  teams: BingoTeam[]
  activationSeed: string
  targetPlayCount?: number
}): {
  winnerTeamId: string
  cardsByTeamId: Record<string, BingoCell[]>
  playOrder: string[]
} {
  const { tracks, teams, activationSeed } = opts
  const targetPlayCount = opts.targetPlayCount ?? 28

  const active = teams.filter((t) => t.name?.trim())
  if (active.length === 0) throw new Error('No active teams for bingo')
  if (tracks.length < 5) throw new Error('Need at least 5 tracks for bingo')

  const seed = hashSeed(activationSeed)
  const winner = active[seed % active.length]

  const shuffledTracks = shuffleWithSeed(tracks, seed + 7)
  const winTracks = shuffledTracks.slice(0, 5)
  const winTrackIds = winTracks.map((t) => t.id)

  const cardsByTeamId: Record<string, BingoCell[]> = {}
  cardsByTeamId[winner.id] = pick25(tracks, seed + 11, winTrackIds)

  for (const team of active) {
    if (team.id === winner.id) continue
    let card = pick25(tracks, hashSeed(team.id + activationSeed), undefined)
    let attempts = 0
    while (
      attempts < 5 &&
      JSON.stringify(card.map((c) => c.trackId)) ===
        JSON.stringify(cardsByTeamId[winner.id].map((c) => c.trackId))
    ) {
      card = pick25(tracks, hashSeed(team.id + activationSeed + String(attempts)), undefined)
      attempts++
    }
    cardsByTeamId[team.id] = card
  }

  const poolIds = tracks.map((t) => t.id)
  const playOrder = buildPlayOrder(winTrackIds, poolIds, targetPlayCount, seed + 99)

  return {
    winnerTeamId: winner.id,
    cardsByTeamId,
    playOrder,
  }
}

export function bingoCellLabels(cells: BingoCell[]): string[] {
  return cells.map((c) => `${c.title} — ${c.artist}`)
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
