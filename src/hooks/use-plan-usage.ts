import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/**
 * Events this org has activated in the current calendar month — the same number
 * the DB gate counts against the plan's monthly limit
 * (assert_event_activation_allowed counts events.activated_at within the month).
 *
 * Kept in its own hook rather than derived from the events list, because that
 * list is filtered/paginated per page and would undercount.
 */
export function useMonthlyEventUsage(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['plan-usage', 'events-this-month', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<number> => {
      const now = new Date()
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

      const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId!)
        .gte('activated_at', monthStart)

      if (error) throw error
      return count ?? 0
    },
  })
}
