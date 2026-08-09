import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/auth-context'
import { useOptionalTenant } from '@/contexts/tenant-context'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { buildSearchResults, type SearchResult } from '@/lib/global-search'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 5

/** Live header search across games, events and support tickets. */
export function useGlobalSearch(query: string): {
  results: SearchResult[]
  isLoading: boolean
} {
  const organizationId = useOrganizationId()
  const { role } = useAuth()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  const trimmed = query.trim()
  const enabled = Boolean(organizationId) && trimmed.length >= MIN_QUERY_LENGTH

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.globalSearch(organizationId, trimmed),
    enabled,
    queryFn: async (): Promise<SearchResult[]> => {
      if (!organizationId) return []
      const pattern = `%${trimmed}%`

      const [gamesRes, eventsRes, ticketsRes] = await Promise.all([
        supabase
          .from('games')
          .select('id, name')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .ilike('name', pattern)
          .limit(RESULT_LIMIT),
        supabase
          .from('events')
          .select('id, name')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .ilike('name', pattern)
          .limit(RESULT_LIMIT),
        supabase
          .from('support_tickets')
          .select('id, subject')
          .eq('organization_id', organizationId)
          .ilike('subject', pattern)
          .limit(RESULT_LIMIT),
      ])

      // One failing surface should not blank the whole dropdown, so errors
      // degrade to an empty list for that surface instead of throwing.
      return buildSearchResults(
        {
          games: gamesRes.data ?? [],
          events: eventsRes.data ?? [],
          tickets: ticketsRes.data ?? [],
        },
        role,
        clientSlug,
      )
    },
  })

  return { results: data ?? [], isLoading: enabled && isFetching }
}
