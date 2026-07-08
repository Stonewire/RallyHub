import type { GameRow } from '@/hooks/use-games'
import { platformGameInstallPayload } from '@/lib/install-platform-game'
import { supabase } from '@/lib/supabase'

export type GroupInstallGameError = {
  gameName: string
  error: string
}

export type InstallPlatformGameGroupClientResult = {
  organizationId: string
  organizationName: string
  ok: boolean
  installedCount: number
  skippedCount: number
  groupRecreated: boolean
  error?: string
  gameErrors: GroupInstallGameError[]
}

export type InstallPlatformGameGroupSummary = {
  groupName: string
  totalGames: number
  results: InstallPlatformGameGroupClientResult[]
}

/** Orgs that already have a copy of this platform template installed. */
export async function installedOrganizationIdsForTemplate(
  template: GameRow,
): Promise<Set<string>> {
  const [bySourceRes, byLegacyRes] = await Promise.all([
    supabase
      .from('games')
      .select('organization_id')
      .eq('source_template_id', template.id),
    supabase
      .from('games')
      .select('organization_id')
      .eq('name', template.name)
      .eq('type', template.type)
      .eq('is_platform_template', false),
  ])

  if (bySourceRes.error) throw bySourceRes.error
  if (byLegacyRes.error) throw byLegacyRes.error

  const installed = new Set<string>()
  for (const row of bySourceRes.data ?? []) {
    installed.add(row.organization_id)
  }
  for (const row of byLegacyRes.data ?? []) {
    installed.add(row.organization_id)
  }
  return installed
}

async function findClientGameIdForTemplate(
  template: GameRow,
  organizationId: string,
): Promise<string | null> {
  const { data: bySource, error: sourceError } = await supabase
    .from('games')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('source_template_id', template.id)
    .maybeSingle()

  if (sourceError) throw sourceError
  if (bySource) return bySource.id

  const { data: byLegacy, error: legacyError } = await supabase
    .from('games')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', template.name)
    .eq('type', template.type)
    .eq('is_platform_template', false)
    .maybeSingle()

  if (legacyError) throw legacyError
  return byLegacy?.id ?? null
}

async function ensureClientGameFromTemplate(
  template: GameRow,
  organizationId: string,
): Promise<{ gameId: string; skipped: boolean }> {
  const existingId = await findClientGameIdForTemplate(template, organizationId)
  if (existingId) {
    return { gameId: existingId, skipped: true }
  }

  const { data, error } = await supabase
    .from('games')
    .insert(platformGameInstallPayload(template, organizationId))
    .select('id')
    .single()

  if (error) throw error
  return { gameId: data.id, skipped: false }
}

async function ensureClientGroup(
  organizationId: string,
  groupName: string,
): Promise<{ groupId: string; created: boolean }> {
  const trimmed = groupName.trim()
  const { data: existing, error: findError } = await supabase
    .from('game_groups')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', trimmed)
    .limit(1)
    .maybeSingle()

  if (findError) throw findError
  if (existing) {
    return { groupId: existing.id, created: false }
  }

  const { data, error } = await supabase
    .from('game_groups')
    .insert({ organization_id: organizationId, name: trimmed })
    .select('id')
    .single()

  if (error) throw error
  return { groupId: data.id, created: true }
}

async function assignGameToClientGroup(gameId: string, groupId: string) {
  const { error: removeError } = await supabase
    .from('game_group_items')
    .delete()
    .eq('game_id', gameId)

  if (removeError) throw removeError

  const { error: insertError } = await supabase.from('game_group_items').insert({
    group_id: groupId,
    game_id: gameId,
  })

  if (insertError) throw insertError
}

export async function installPlatformGameGroupToClient({
  groupName,
  templates,
  organizationId,
}: {
  groupName: string
  templates: GameRow[]
  organizationId: string
}): Promise<Omit<InstallPlatformGameGroupClientResult, 'organizationId' | 'organizationName'>> {
  if (templates.length === 0) {
    return {
      ok: false,
      installedCount: 0,
      skippedCount: 0,
      groupRecreated: false,
      error: 'This group has no games to install.',
      gameErrors: [],
    }
  }

  let installedCount = 0
  let skippedCount = 0
  const gameErrors: GroupInstallGameError[] = []
  let groupRecreated: boolean

  let clientGroupId: string
  try {
    const group = await ensureClientGroup(organizationId, groupName)
    clientGroupId = group.groupId
    groupRecreated = group.created
  } catch (err) {
    return {
      ok: false,
      installedCount: 0,
      skippedCount: 0,
      groupRecreated: false,
      error: err instanceof Error ? err.message : 'Could not create client group',
      gameErrors: [],
    }
  }

  for (const template of templates) {
    try {
      const { gameId, skipped } = await ensureClientGameFromTemplate(template, organizationId)
      if (skipped) skippedCount += 1
      else installedCount += 1
      await assignGameToClientGroup(gameId, clientGroupId)
    } catch (err) {
      gameErrors.push({
        gameName: template.name,
        error: err instanceof Error ? err.message : 'Install failed',
      })
    }
  }

  const ok = gameErrors.length === 0
  return {
    ok,
    installedCount,
    skippedCount,
    groupRecreated,
    gameErrors,
    error:
      gameErrors.length > 0
        ? `${gameErrors.length} game${gameErrors.length === 1 ? '' : 's'} could not be installed`
        : undefined,
  }
}

export async function installPlatformGameGroup({
  groupName,
  templates,
  organizationIds,
  organizationNames,
}: {
  groupName: string
  templates: GameRow[]
  organizationIds: string[]
  organizationNames: Record<string, string>
}): Promise<InstallPlatformGameGroupSummary> {
  const results: InstallPlatformGameGroupClientResult[] = []

  for (const organizationId of organizationIds) {
    const organizationName = organizationNames[organizationId] ?? organizationId
    const outcome = await installPlatformGameGroupToClient({
      groupName,
      templates,
      organizationId,
    })
    results.push({
      organizationId,
      organizationName,
      ...outcome,
    })
  }

  return {
    groupName,
    totalGames: templates.length,
    results,
  }
}

export function groupInstallStatusKey(templateIds: string[]) {
  return [...templateIds].sort().join(',')
}

export async function fetchGroupClientInstallCounts(
  templates: GameRow[],
): Promise<Map<string, { installedCount: number; total: number; allInstalled: boolean }>> {
  const total = templates.length
  const counts = new Map<string, number>()

  if (total === 0) return new Map()

  for (const template of templates) {
    const orgIds = await installedOrganizationIdsForTemplate(template)
    for (const orgId of orgIds) {
      counts.set(orgId, (counts.get(orgId) ?? 0) + 1)
    }
  }

  const status = new Map<string, { installedCount: number; total: number; allInstalled: boolean }>()
  for (const [orgId, installedCount] of counts) {
    status.set(orgId, {
      installedCount,
      total,
      allInstalled: installedCount >= total,
    })
  }
  return status
}
