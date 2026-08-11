import {
  collectEventGameIds,
  ensureBookendStages,
  unclaimedTeamSlots,
} from '@/lib/event-form-utils'
import type { EventStage } from '@/types/game-config'
import type { Tables, TablesInsert } from '@/types/helpers'

function cloneStagesWithNewIds(stages: EventStage[]): EventStage[] {
  return stages.map((stage) => ({
    ...stage,
    id: crypto.randomUUID(),
    gameIds: stage.gameIds ? [...stage.gameIds] : undefined,
  }))
}

export function buildDuplicateEventPayload(
  source: Tables<'events'>,
  gameIds: string[],
): { event: TablesInsert<'events'>; gameIds: string[] } {
  const stages = ensureBookendStages(
    Array.isArray(source.stages_config)
      ? cloneStagesWithNewIds(source.stages_config as EventStage[])
      : [],
  )

  const resolvedGameIds = collectEventGameIds(gameIds, stages)

  return {
    event: {
      organization_id: source.organization_id,
      name: `Copy of ${source.name}`,
      event_date: source.event_date,
      status: 'draft',
      team_count: source.team_count,
      branding_enabled: source.branding_enabled,
      logo_url: source.logo_url,
      brand_colors: source.brand_colors,
      teams_config: unclaimedTeamSlots(source.team_count),
      stages_config: stages,
      display_layout: source.display_layout,
      display_text_color: source.display_text_color,
      invoice_paid: false,
      invoiced_at: null,
      // A copy has not run yet. Without clearing this it would inherit the
      // original's activation and be born locked to "Archived".
      activated_at: null,
      list_order: 0,
    },
    gameIds: resolvedGameIds,
  }
}
