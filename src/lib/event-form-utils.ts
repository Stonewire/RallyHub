import type { Json } from '@/types/json'
import {
  DEFAULT_BRAND_COLORS,
  normalizeBrandColorTriple,
  type DisplayLayout,
  type DisplayTextColor,
} from '@/lib/live-event'
import type { EventStage, EventTeam } from '@/types/game-config'
import type { Tables } from '@/types/helpers'
import { INCLUDED_TEAMS_PER_EVENT } from '@/lib/subscription-plans'

export type EventFormValues = {
  name: string
  eventDate: string
  /** Free-text venue, shown on event cards. Display only, never parsed. */
  location: string
  teamCount: number
  teams: EventTeam[]
  brandingEnabled: boolean
  /** Shows the participant "Buy Items" button and allows Inventory purchases. */
  inventoryEnabled: boolean
  logoUrl: string | null
  brandColors: [string, string, string]
  displayLayout: DisplayLayout
  displayTextColor: DisplayTextColor
  selectedGameIds: string[]
  stages: EventStage[]
}

export const TEAM_COLORS = [
  '#E53935',
  '#1E88E5',
  '#43A047',
  '#FB8C00',
  '#8E24AA',
  '#00ACC1',
  '#FDD835',
  '#6D4C41',
]

export function defaultTeams(count: number): EventTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Team ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
  }))
}

/** Empty team slots for a new or duplicated event (no names claimed). */
export function unclaimedTeamSlots(count: number): EventTeam[] {
  const n = Math.max(1, Math.min(20, count))
  return Array.from({ length: n }, (_, i) => ({
    id: crypto.randomUUID(),
    name: '',
    color: TEAM_COLORS[i % TEAM_COLORS.length],
  }))
}

export function defaultStages(): EventStage[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Stage 1',
      type: 'open',
      gameId: null,
      gameIds: [],
    },
  ]
}

export function addStage(stages: EventStage[]): EventStage[] {
  return [
    ...stages,
    {
      id: crypto.randomUUID(),
      name: `Stage ${stages.length + 1}`,
      type: 'open',
      gameId: null,
      gameIds: [],
    },
  ]
}

/**
 * Moves one stage earlier or later in the running order.
 *
 * Returns the list unchanged when the move would fall off either end, so the
 * caller can wire it to a button without guarding the edges twice.
 */
export function moveStage(
  stages: EventStage[],
  index: number,
  delta: number,
): EventStage[] {
  const target = index + delta
  if (index < 0 || index >= stages.length) return stages
  if (target < 0 || target >= stages.length) return stages
  const next = [...stages]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

export function toLocalDatetime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseBrandColors(raw: Json | null | undefined): [string, string, string] {
  return normalizeBrandColorTriple(raw, DEFAULT_BRAND_COLORS)
}

export function eventToFormValues(
  event: Tables<'events'>,
  gameIds: string[],
): EventFormValues {
  const teams = Array.isArray(event.teams_config)
    ? (event.teams_config as EventTeam[])
    : defaultTeams(event.team_count)
  const stages = Array.isArray(event.stages_config)
    ? (event.stages_config as EventStage[])
    : defaultStages()

  return {
    name: event.name,
    eventDate: toLocalDatetime(event.event_date),
    location: event.location ?? '',
    teamCount: event.team_count,
    teams,
    brandingEnabled: event.branding_enabled,
    inventoryEnabled: event.inventory_enabled ?? true,
    logoUrl: event.logo_url,
    brandColors: parseBrandColors(event.brand_colors),
    displayLayout:
      event.display_layout === 'orbit_view' ? 'orbit_view' : 'rank_list',
    displayTextColor:
      event.display_text_color === 'black' ? 'black' : 'white',
    selectedGameIds: gameIds,
    stages: stages.length ? stages : defaultStages(),
  }
}

/** All game ids needed for live bundle (selected + referenced in stages). */
export function collectEventGameIds(
  selectedGameIds: string[],
  stages: EventStage[],
): string[] {
  const ids = new Set(selectedGameIds)
  for (const stage of stages) {
    if (stage.gameId) ids.add(stage.gameId)
    for (const id of stage.gameIds ?? []) ids.add(id)
  }
  return [...ids]
}

export function emptyEventForm(): EventFormValues {
  return {
    name: '',
    eventDate: '',
    location: '',
    teamCount: INCLUDED_TEAMS_PER_EVENT,
    teams: defaultTeams(INCLUDED_TEAMS_PER_EVENT),
    brandingEnabled: true,
    inventoryEnabled: true,
    logoUrl: null,
    brandColors: ['#3E3D3E', '#6f6f6f', '#FFC107'],
    displayLayout: 'rank_list',
    displayTextColor: 'white',
    selectedGameIds: [],
    stages: defaultStages(),
  }
}
