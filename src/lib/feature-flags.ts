import type { GameType } from '@/types/database'
import type { Json } from '@/types/json'

/**
 * P6.1 per-client feature flags.
 *
 * `organizations.feature_flags` is one jsonb column, column-guarded so only
 * RallyHub staff (super_admin) and service_role can change it. The semantics
 * are deliberately fail-open: an ABSENT key means allowed, so every existing
 * client keeps everything and a failed org read never locks anyone out.
 *
 * These flags gate CREATION and config surfaces only (new games, stage type
 * pickers, the event store section, imports, platform-library installs, and
 * the offline package downloads on the player surface). Already-built content
 * keeps rendering and playing everywhere.
 */

export const ALL_GAME_TYPES: readonly GameType[] = [
  'photo',
  'video',
  'text',
  'quiz',
  'music_bingo',
  'puzzle',
] as const

/** Stage types a client can be limited to. Welcome/End bookends are never gated. */
export type FlagStageType = 'open' | 'quiz' | 'bingo' | 'break'

export const ALL_FLAG_STAGE_TYPES: readonly FlagStageType[] = [
  'open',
  'quiz',
  'bingo',
  'break',
] as const

/** Fully resolved flags: absent keys already expanded to "everything allowed". */
export type FeatureFlags = {
  allowedGameTypes: GameType[]
  storeEnabled: boolean
  offlineEnabled: boolean
  allowedStageTypes: FlagStageType[]
}

export function defaultFeatureFlags(): FeatureFlags {
  return {
    allowedGameTypes: [...ALL_GAME_TYPES],
    storeEnabled: true,
    offlineEnabled: true,
    allowedStageTypes: [...ALL_FLAG_STAGE_TYPES],
  }
}

/** Anything carrying a feature_flags column-ish value (org row, tenant RPC row). */
export type FeatureFlagSource = { feature_flags?: unknown } | null | undefined

function parseStringArray<T extends string>(
  raw: unknown,
  known: readonly T[],
): T[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<T>()
  for (const value of raw) {
    if (typeof value === 'string' && (known as readonly string[]).includes(value)) {
      seen.add(value as T)
    }
  }
  // Keep the canonical order so UI lists stay stable regardless of stored order.
  return known.filter((value) => seen.has(value))
}

/**
 * Tolerant parse of the raw jsonb value. Junk (wrong types, unknown values,
 * null, strings) degrades to "allowed", never to "blocked": these flags must
 * not be able to break an admin screen or a live surface through bad data.
 * An explicitly PRESENT empty array does mean "none allowed".
 */
export function parseFeatureFlags(raw: unknown): FeatureFlags {
  const flags = defaultFeatureFlags()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return flags
  const record = raw as Record<string, unknown>

  const gameTypes = parseStringArray(record.allowed_game_types, ALL_GAME_TYPES)
  if (gameTypes !== null) flags.allowedGameTypes = gameTypes

  if (typeof record.store_enabled === 'boolean') {
    flags.storeEnabled = record.store_enabled
  }
  if (typeof record.offline_enabled === 'boolean') {
    flags.offlineEnabled = record.offline_enabled
  }

  const stageTypes = parseStringArray(record.allowed_stage_types, ALL_FLAG_STAGE_TYPES)
  if (stageTypes !== null) flags.allowedStageTypes = stageTypes

  return flags
}

export function orgFeatureFlags(org: FeatureFlagSource): FeatureFlags {
  return parseFeatureFlags(org?.feature_flags)
}

export function allowedGameTypes(org: FeatureFlagSource): GameType[] {
  return orgFeatureFlags(org).allowedGameTypes
}

export function isGameTypeAllowed(org: FeatureFlagSource, type: GameType): boolean {
  return orgFeatureFlags(org).allowedGameTypes.includes(type)
}

export function storeEnabled(org: FeatureFlagSource): boolean {
  return orgFeatureFlags(org).storeEnabled
}

export function offlineEnabled(org: FeatureFlagSource): boolean {
  return orgFeatureFlags(org).offlineEnabled
}

export function allowedStageTypes(org: FeatureFlagSource): FlagStageType[] {
  return orgFeatureFlags(org).allowedStageTypes
}

export function isStageTypeAllowed(org: FeatureFlagSource, type: FlagStageType): boolean {
  return orgFeatureFlags(org).allowedStageTypes.includes(type)
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value))
}

/**
 * Serialise resolved flags back to the stored shape, omitting every key that
 * matches the default so "everything allowed" stays the empty object and
 * existing clients keep an untouched `{}` column.
 */
export function featureFlagsToJson(flags: FeatureFlags): Json {
  const out: Record<string, Json> = {}
  if (!sameMembers(flags.allowedGameTypes, ALL_GAME_TYPES)) {
    out.allowed_game_types = [...flags.allowedGameTypes]
  }
  if (!flags.storeEnabled) out.store_enabled = false
  if (!flags.offlineEnabled) out.offline_enabled = false
  if (!sameMembers(flags.allowedStageTypes, ALL_FLAG_STAGE_TYPES)) {
    out.allowed_stage_types = [...flags.allowedStageTypes]
  }
  return out
}
