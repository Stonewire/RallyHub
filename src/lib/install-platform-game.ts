import type { GameRow } from '@/hooks/use-games'
import type { TablesInsert } from '@/types/helpers'

/** Client copy fields copied from a platform template (not a shared reference). */
export function platformGameInstallPayload(
  template: GameRow,
  organizationId: string,
): TablesInsert<'games'> {
  return {
    organization_id: organizationId,
    name: template.name,
    type: template.type,
    description: template.description,
    cover_url: template.cover_url,
    points_type: template.points_type,
    points_static: template.points_static,
    points_min: template.points_min,
    points_max: template.points_max,
    solution_description: template.solution_description,
    solution_image_url: template.solution_image_url,
    status: 'draft',
    config: template.config,
    is_platform_template: false,
    is_default_for_new_clients: false,
    source_template_id: template.id,
  }
}
