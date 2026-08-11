/**
 * Builds the event's aggregated prep checklist.
 *
 * Each source (a game or a store item) lists the physical kit it needs for ONE
 * team. Identical item names are grouped across sources and their per-team
 * counts summed, then multiplied by the team count. Tick state is keyed by the
 * normalised item name and reset whenever the team count changes.
 */

export type ChecklistSourceKind = 'game' | 'store'

export type ChecklistSourceInput = {
  kind: ChecklistSourceKind
  label: string
  items: string[]
}

export type ChecklistSource = { kind: ChecklistSourceKind; label: string }

export type ChecklistItemRow = {
  /** Display name, first-seen casing. */
  name: string
  /** Normalised (lowercased) key: stable id for tick state, case-insensitive grouping. */
  key: string
  /** Units needed per one team (number of sources that list it). */
  perTeam: number
  /** perTeam × team count. */
  total: number
  sources: ChecklistSource[]
}

export function buildEventChecklist(
  sources: ChecklistSourceInput[],
  teamCount: number,
): ChecklistItemRow[] {
  const map = new Map<string, ChecklistItemRow>()

  for (const source of sources) {
    // Dedupe within a single source so a stray repeat can't inflate per-team.
    const seen = new Set<string>()
    for (const raw of source.items ?? []) {
      const name = raw.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const existing = map.get(key)
      if (existing) {
        existing.perTeam += 1
        existing.sources.push({ kind: source.kind, label: source.label })
      } else {
        map.set(key, {
          name,
          key,
          perTeam: 1,
          total: 0,
          sources: [{ kind: source.kind, label: source.label }],
        })
      }
    }
  }

  const teams = Math.max(0, Math.floor(teamCount))
  const rows = [...map.values()]
  for (const row of rows) row.total = row.perTeam * teams
  // Most-needed first, then alphabetical, so the biggest piles are packed first.
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  return rows
}

export type ChecklistState = { teamCount: number; checked: Record<string, boolean> }

/**
 * Reads stored tick state, but only if it was saved for the current team count.
 * A team-count change makes the stored quantities stale, so the whole list must
 * read as unpacked again — returning {} does exactly that.
 */
export function parseChecklistState(
  raw: unknown,
  currentTeamCount: number,
): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const state = raw as { teamCount?: unknown; checked?: unknown }
  if (typeof state.teamCount !== 'number' || state.teamCount !== currentTeamCount) return {}
  if (!state.checked || typeof state.checked !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(state.checked as Record<string, unknown>)) {
    if (v === true) out[k] = true
  }
  return out
}
