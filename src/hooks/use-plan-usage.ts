import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

/**
 * Events this org has activated in the current calendar month — the same number
 * the DB gate counts against the plan's monthly limit
 * (assert_event_activation_allowed counts events.activated_at within the month
 * PLUS this month's event_occurrences: finished runs of restarted recurring
 * events, whose events.activated_at was cleared by the restart). Without the
 * occurrence count the Billing meter under-reads the gate after every restart.
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

      const [eventsRes, occurrencesRes] = await Promise.all([
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId!)
          .gte('activated_at', monthStart),
        supabase
          .from('event_occurrences')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId!)
          .gte('activated_at', monthStart),
      ])

      if (eventsRes.error) throw eventsRes.error
      if (occurrencesRes.error) throw occurrencesRes.error
      return (eventsRes.count ?? 0) + (occurrencesRes.count ?? 0)
    },
  })
}
