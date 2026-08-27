import { describe, expect, it } from 'vitest'

import {
  ALL_FLAG_STAGE_TYPES,
  ALL_GAME_TYPES,
  allowedGameTypes,
  allowedStageTypes,
  defaultFeatureFlags,
  featureFlagsToJson,
  isGameTypeAllowed,
  isStageTypeAllowed,
  offlineEnabled,
  orgFeatureFlags,
  parseFeatureFlags,
  storeEnabled,
} from '@/lib/feature-flags'

describe('parseFeatureFlags', () => {
  it('treats an empty object as everything allowed', () => {
    expect(parseFeatureFlags({})).toEqual(defaultFeatureFlags())
  })

  it('treats null, undefined, arrays and scalars as everything allowed', () => {
    for (const junk of [null, undefined, [], 'quiz', 42, true]) {
      expect(parseFeatureFlags(junk)).toEqual(defaultFeatureFlags())
    }
  })

  it('reads a restricted game type list and keeps canonical order', () => {
    const flags = parseFeatureFlags({ allowed_game_types: ['puzzle', 'quiz', 'quiz'] })
    expect(flags.allowedGameTypes).toEqual(['quiz', 'puzzle'])
  })

  it('drops unknown game types instead of failing', () => {
    const flags = parseFeatureFlags({
      allowed_game_types: ['quiz', 'karaoke', 7, null, 'photo'],
    })
    expect(flags.allowedGameTypes).toEqual(['photo', 'quiz'])
  })

  it('keeps a PRESENT empty array as "none allowed"', () => {
    expect(parseFeatureFlags({ allowed_game_types: [] }).allowedGameTypes).toEqual([])
    expect(parseFeatureFlags({ allowed_stage_types: [] }).allowedStageTypes).toEqual([])
  })

  it('treats a non-array allowed_game_types as absent', () => {
    expect(
      parseFeatureFlags({ allowed_game_types: 'quiz' }).allowedGameTypes,
    ).toEqual([...ALL_GAME_TYPES])
  })

  it('reads booleans and ignores non-boolean junk for the switches', () => {
    expect(parseFeatureFlags({ store_enabled: false }).storeEnabled).toBe(false)
    expect(parseFeatureFlags({ offline_enabled: false }).offlineEnabled).toBe(false)
    expect(parseFeatureFlags({ store_enabled: 'no' }).storeEnabled).toBe(true)
    expect(parseFeatureFlags({ offline_enabled: 0 }).offlineEnabled).toBe(true)
  })

  it('reads a restricted stage type list', () => {
    const flags = parseFeatureFlags({ allowed_stage_types: ['quiz', 'nonsense'] })
    expect(flags.allowedStageTypes).toEqual(['quiz'])
  })
})

describe('org helpers', () => {
  const quizOnly = {
    feature_flags: {
      allowed_game_types: ['quiz'],
      store_enabled: false,
      offline_enabled: false,
      allowed_stage_types: ['quiz', 'break'],
    },
  }

  it('resolves helpers from an org-shaped source', () => {
    expect(allowedGameTypes(quizOnly)).toEqual(['quiz'])
    expect(isGameTypeAllowed(quizOnly, 'quiz')).toBe(true)
    expect(isGameTypeAllowed(quizOnly, 'photo')).toBe(false)
    expect(storeEnabled(quizOnly)).toBe(false)
    expect(offlineEnabled(quizOnly)).toBe(false)
    expect(allowedStageTypes(quizOnly)).toEqual(['quiz', 'break'])
    expect(isStageTypeAllowed(quizOnly, 'open')).toBe(false)
    expect(isStageTypeAllowed(quizOnly, 'break')).toBe(true)
  })

  it('falls back to everything allowed for a missing org or column', () => {
    expect(orgFeatureFlags(null)).toEqual(defaultFeatureFlags())
    expect(orgFeatureFlags(undefined)).toEqual(defaultFeatureFlags())
    expect(orgFeatureFlags({})).toEqual(defaultFeatureFlags())
    expect(isGameTypeAllowed(null, 'music_bingo')).toBe(true)
    expect(storeEnabled(null)).toBe(true)
    expect(offlineEnabled(null)).toBe(true)
    expect(isStageTypeAllowed(null, 'bingo')).toBe(true)
  })
})

describe('featureFlagsToJson', () => {
  it('serialises defaults to the empty object', () => {
    expect(featureFlagsToJson(defaultFeatureFlags())).toEqual({})
  })

  it('omits keys that still match the default', () => {
    const flags = defaultFeatureFlags()
    flags.storeEnabled = false
    expect(featureFlagsToJson(flags)).toEqual({ store_enabled: false })
  })

  it('round-trips a restricted set through parse', () => {
    const flags = defaultFeatureFlags()
    flags.allowedGameTypes = ['quiz']
    flags.offlineEnabled = false
    flags.allowedStageTypes = ['quiz', 'break']
    expect(parseFeatureFlags(featureFlagsToJson(flags))).toEqual(flags)
  })

  it('treats a reordered full set as the default', () => {
    const flags = defaultFeatureFlags()
    flags.allowedStageTypes = [...ALL_FLAG_STAGE_TYPES].reverse()
    expect(featureFlagsToJson(flags)).toEqual({})
  })
})
