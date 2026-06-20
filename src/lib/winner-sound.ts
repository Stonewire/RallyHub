export type WinnerSoundSurface = 'display' | 'facilitator' | 'players'

export const WINNER_SOUND_SURFACES: {
  id: WinnerSoundSurface
  label: string
  description: string
}[] = [
  {
    id: 'display',
    label: 'Display',
    description: 'The big-screen audience display plays the winner announcement.',
  },
  {
    id: 'facilitator',
    label: 'Facilitator',
    description: 'Your facilitator device plays the winner announcement.',
  },
  {
    id: 'players',
    label: 'Players',
    description: 'Every player phone plays the winner announcement.',
  },
]

/** Normalize a stored value into a clean list of known surfaces (or null). */
export function parseWinnerSoundTargets(raw: unknown): WinnerSoundSurface[] | null {
  if (!Array.isArray(raw)) return null
  const known = WINNER_SOUND_SURFACES.map((s) => s.id)
  const list = raw.filter((v): v is WinnerSoundSurface =>
    typeof v === 'string' && (known as string[]).includes(v),
  )
  return list
}

/**
 * Whether the winner sound should play on a given surface. NULL targets (never
 * chosen / legacy events) default to playing everywhere.
 */
export function winnerSoundEnabled(
  targets: unknown,
  surface: WinnerSoundSurface,
): boolean {
  const parsed = parseWinnerSoundTargets(targets)
  if (parsed === null) return true
  return parsed.includes(surface)
}
