import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { EventStatus } from '@/types/database'
import type { RallyStatusTone } from '@/components/ui/status-indicator'

export type DashboardStats = {
  totalGames: number
  totalEvents: number
  activeEvents: number
  upcomingEvents: number
}

export type RecentEventRow = {
  id: string
  name: string
  dateISO: string | null
  status: RallyStatusTone
}

function toRallyStatus(status: EventStatus): RallyStatusTone {
  return status
}

export function useDashboardStats(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.dashboardStats(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<DashboardStats> => {
      if (!organizationId) {
        return {
          totalGames: 0,
          totalEvents: 0,
          activeEvents: 0,
          upcomingEvents: 0,
        }
      }

      const [gamesRes, eventsRes, activeRes, readyRes] = await Promise.all([
        supabase
          .from('games')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .is('deleted_at', null),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .is('deleted_at', null),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .is('deleted_at', null),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'ready')
          .is('deleted_at', null),
      ])

      if (gamesRes.error) throw gamesRes.error
      if (eventsRes.error) throw eventsRes.error
      if (activeRes.error) throw activeRes.error
      if (readyRes.error) throw readyRes.error

      return {
        totalGames: gamesRes.count ?? 0,
        totalEvents: eventsRes.count ?? 0,
        activeEvents: activeRes.count ?? 0,
        upcomingEvents: readyRes.count ?? 0,
      }
    },
  })
}

export function useRecentEvents(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.recentEvents(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<RecentEventRow[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, status, created_at')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        dateISO: row.event_date ?? row.created_at,
        status: toRallyStatus(row.status as EventStatus),
      }))
    },
  })
}
