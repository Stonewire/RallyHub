import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  defaultFeatureFlags,
  orgFeatureFlags,
  type FeatureFlags,
} from '@/lib/feature-flags'

/**
 * The signed-in profile's org flags for admin creation/config surfaces.
 *
 * Reuses the shared organization query (queryKeys.organization), so admin
 * pages that already loaded the org row pay nothing extra. While loading, or
 * for profiles with no organization (RallyHub staff), everything is allowed:
 * the flags fail open by design, and the platform game library is never gated.
 */
export function useOrgFeatureFlags(): { flags: FeatureFlags; isLoading: boolean } {
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  return {
    flags: orgQuery.data ? orgFeatureFlags(orgQuery.data) : defaultFeatureFlags(),
    isLoading: Boolean(organizationId) && orgQuery.isLoading,
  }
}
