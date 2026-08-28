import type { Json } from '@/types/json'
import {
  DEFAULT_BRAND_COLORS,
  normalizeBrandColorTriple,
  type DisplayLayout,
  type DisplayTextColor,
} from '@/lib/live-event'
import type { EventStage, EventStoreItem, EventTeam } from '@/types/game-config'
import type { Tables } from '@/types/helpers'
import { INCLUDED_TEAMS_PER_EVENT } from '@/lib/subscription-plans'
import { toAppLanguage, type AppLanguage } from '@/lib/i18n'

export type EventFormValues = {
  name: string
  eventDate: string
  /** UI language for every live surface of this event (join, display, facilitator). */
  language: AppLanguage
  /** Lets each team pick its own language at join, from availableLanguages. */
  multilingual: boolean
  /** Languages offered to teams when multilingual is on. */
  availableLanguages: AppLanguage[]
  /** Free-text venue, shown on event cards. Display only, never parsed. */
  location: string
  teamCount: number
  teams: EventTeam[]
  /** P6.3: participants create their own teams at join; no pre-created slots. */
  openJoining: boolean
  brandingEnabled: boolean
  /** Shows the participant "Buy Items" button and allows Inventory purchases. */
  inventoryEnabled: boolean
  /** P6.4: the same event runs repeatedly; data resets between runs. */
  recurring: boolean
  logoUrl: string | null
  brandColors: [string, string, string]
  displayLayout: DisplayLayout
  displayTextColor: DisplayTextColor
  selectedGameIds: string[]
  stages: EventStage[]
  /** Inventory items on sale at this event, with stock and per-team limits. */
  store: EventStoreItem[]
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

export const WELCOME_STAGE_MESSAGE = 'Welcome! Games starting soon, stay tuned.'
export const END_STAGE_MESSAGE = "That's a wrap! Thanks for playing."

export function isBookendStage(stage: EventStage): boolean {
  return stage.type === 'welcome' || stage.type === 'end'
}

function makeWelcomeStage(): EventStage {
  return { id: crypto.randomUUID(), name: 'Welcome', type: 'welcome', message: WELCOME_STAGE_MESSAGE }
}

function makeEndStage(): EventStage {
  return { id: crypto.randomUUID(), name: 'End', type: 'end', message: END_STAGE_MESSAGE }
}

/**
 * Guarantees exactly one welcome stage pinned first and one end stage pinned
 * last, preserving any existing bookend's message. Run when loading an event
 * into the editor and when building a new/duplicated event, so the pins are
 * enforced at the one place that persists stages_config, never by rewriting a
 * live event's array out from under its current_stage_index.
 */
export function ensureBookendStages(stages: EventStage[]): EventStage[] {
  const welcome = stages.find((s) => s.type === 'welcome') ?? makeWelcomeStage()
  const end = stages.find((s) => s.type === 'end') ?? makeEndStage()
  const middle = stages.filter((s) => !isBookendStage(s))
  return [welcome, ...middle, end]
}

export function defaultStages(): EventStage[] {
  return ensureBookendStages([
    {
      id: crypto.randomUUID(),
      name: 'Stage 1',
      type: 'open',
      gameId: null,
      gameIds: [],
    },
  ])
}

/** Adds a new game stage just before the pinned end stage. */
export function addStage(stages: EventStage[]): EventStage[] {
  const middleCount = stages.filter((s) => !isBookendStage(s)).length
  const newStage: EventStage = {
    id: crypto.randomUUID(),
    name: `Stage ${middleCount + 1}`,
    type: 'open',
    gameId: null,
    gameIds: [],
  }
  const endIndex = stages.findIndex((s) => s.type === 'end')
  if (endIndex === -1) return [...stages, newStage]
  const next = [...stages]
  next.splice(endIndex, 0, newStage)
  return next
}

/**
 * Moves one stage earlier or later in the running order.
 *
 * Bookends (welcome/end) never move, and no other stage can be pushed above the
 * welcome or below the end. Returns the list unchanged when a move is refused,
 * so the caller can wire it to a button without guarding the edges twice.
 */
export function moveStage(
  stages: EventStage[],
  index: number,
  delta: number,
): EventStage[] {
  if (index < 0 || index >= stages.length) return stages
  if (isBookendStage(stages[index])) return stages
  const lower = stages[0]?.type === 'welcome' ? 1 : 0
  const upper = stages[stages.length - 1]?.type === 'end' ? stages.length - 2 : stages.length - 1
  const target = index + delta
  if (target < lower || target > upper) return stages
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

/**
 * The languages actually written to the event.
 *
 * The event language is always included: it is the fallback for a team that
 * never picks one, so offering the picker without it could strand a team on a
 * language the organiser did not choose. Returns [] when multilingual is off.
 */
export function availableLanguagesForSave(values: EventFormValues): string[] {
  if (!values.multilingual) return []
  return [...new Set([values.language, ...values.availableLanguages])]
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
  const parsedStages =
    Array.isArray(event.stages_config) && event.stages_config.length
      ? (event.stages_config as EventStage[])
      : defaultStages()
  // Injecting a leading Welcome shifts every stage index by one. An event that
  // is or has been live has event_state.current_stage_index pointing into the
  // stored array, so reshaping it here (then persisting on the next save) would
  // desync the running stage. Only inject bookends when safe: the event is a
  // pre-live draft/ready never activated, OR it already carries them (in which
  // case ensureBookendStages is idempotent and shifts nothing).
  const alreadyBookended = parsedStages[0]?.type === 'welcome'
  const safeToInject =
    (event.status === 'draft' || event.status === 'ready') && event.activated_at == null
  const stages =
    safeToInject || alreadyBookended ? ensureBookendStages(parsedStages) : parsedStages

  return {
    name: event.name,
    eventDate: toLocalDatetime(event.event_date),
    language: toAppLanguage(event.language),
    multilingual: event.multilingual ?? false,
    availableLanguages: (event.available_languages ?? []).map(toAppLanguage),
    location: event.location ?? '',
    teamCount: event.team_count,
    teams,
    openJoining: event.open_joining ?? false,
    brandingEnabled: event.branding_enabled,
    inventoryEnabled: event.inventory_enabled ?? true,
    recurring: event.recurring ?? false,
    logoUrl: event.logo_url,
    brandColors: parseBrandColors(event.brand_colors),
    displayLayout:
      event.display_layout === 'orbit_view' ? 'orbit_view' : 'rank_list',
    displayTextColor:
      event.display_text_color === 'black' ? 'black' : 'white',
    selectedGameIds: gameIds,
    stages,
    store: parseStoreConfig(event.store_config),
  }
}

/**
 * Store rows from the events jsonb, ignoring anything malformed rather than
 * crashing the designer: an item deleted from the library leaves an id that
 * simply no longer resolves, and the picker drops it on the next save.
 */
export function parseStoreConfig(raw: Json | null | undefined): EventStoreItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    const itemId = typeof row.itemId === 'string' ? row.itemId : null
    if (!itemId) return []
    const totalStock = Number(row.totalStock)
    const perTeamLimit = Number(row.perTeamLimit)
    return [
      {
        itemId,
        totalStock: Number.isFinite(totalStock) ? Math.max(0, Math.floor(totalStock)) : 0,
        perTeamLimit: Number.isFinite(perTeamLimit)
          ? Math.max(1, Math.floor(perTeamLimit))
          : 1,
      },
    ]
  })
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
    language: 'en',
    multilingual: false,
    availableLanguages: [],
    location: '',
    teamCount: INCLUDED_TEAMS_PER_EVENT,
    teams: defaultTeams(INCLUDED_TEAMS_PER_EVENT),
    openJoining: false,
    brandingEnabled: true,
    inventoryEnabled: true,
    recurring: false,
    logoUrl: null,
    brandColors: ['#3E3D3E', '#6f6f6f', '#FFC107'],
    displayLayout: 'rank_list',
    displayTextColor: 'white',
    selectedGameIds: [],
    stages: defaultStages(),
    store: [],
  }
}
