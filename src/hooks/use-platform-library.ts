import { useQuery } from '@tanstack/react-query'

import {
  PLATFORM_LIBRARY_SUBDOMAIN,
  platformOrgIdFromEnv,
} from '@/lib/platform-library'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

export function useIsPlatformGamesAdmin(): boolean {
  const { role, profileLoading } = useAuth()
  if (profileLoading) return false
  return canAccessRallyHub(role) && isPlatformHost()
}

export function usePlatformLibraryOrganizationId(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: queryKeys.platformLibraryOrg(),
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string> => {
      const envId = platformOrgIdFromEnv()
      if (envId) {
        const { data, error } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', envId)
          .maybeSingle()
        if (error) throw error
        if (data?.id) return data.id
      }

      const { data: bySub, error: subErr } = await supabase
        .from('organizations')
        .select('id')
        .eq('subdomain', PLATFORM_LIBRARY_SUBDOMAIN)
        .maybeSingle()
      if (subErr) throw subErr
      if (bySub?.id) return bySub.id

      const { data: fromGame, error: gameErr } = await supabase
        .from('games')
        .select('organization_id')
        .eq('is_platform_template', true)
        .limit(1)
        .maybeSingle()
      if (gameErr) throw gameErr
      if (fromGame?.organization_id) return fromGame.organization_id

      const { data: created, error: createErr } = await supabase
        .from('organizations')
        .insert({
          name: 'RallyHub Game Library',
          subdomain: PLATFORM_LIBRARY_SUBDOMAIN,
          billing_plan: 'partner',
          account_status: 'active',
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      return created.id
    },
  })
}
