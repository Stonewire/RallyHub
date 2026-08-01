import { useQuery } from '@tanstack/react-query'

import {
  ACTIVITY_WINDOW_DAYS,
  bucketActivity,
  tallyGameTypes,
  type ActivityMetric,
  type ActivityPoint,
  type GameTypeCount,
} from '@/lib/dashboard-activity'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { EventStatus, GameType } from '@/types/database'
import type { RallyStatusTone } from '@/components/ui/status-indicator'

export type DashboardStats = {
  totalGames: number
  totalEvents: number
  activeEvents: number
  upcomingEvents: number
  /**
   * Change against the count seven days ago, for the stats where that can be
   * reconstructed honestly. Games and events carry created_at and deleted_at,
   * so "how many existed a week ago" is exact. Live Now and Upcoming Events are
   * derived from the current status column and no status history is recorded,
   * so their week-ago value is unknowable and no delta is offered.
   */
  gamesDelta: number
  totalEventsDelta: number
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
          gamesDelta: 0,
          totalEventsDelta: 0,
        }
      }

      // Anything created after this, or deleted before it, did not count a week ago.
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const existedThen = `deleted_at.is.null,deleted_at.gte.${weekAgo}`

      const [gamesRes, eventsRes, activeRes, readyRes, gamesThenRes, eventsThenRes] =
        await Promise.all([
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
        supabase
          .from('games')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .lt('created_at', weekAgo)
          .or(existedThen),
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .lt('created_at', weekAgo)
          .or(existedThen),
      ])

      if (gamesRes.error) throw gamesRes.error
      if (eventsRes.error) throw eventsRes.error
      if (activeRes.error) throw activeRes.error
      if (readyRes.error) throw readyRes.error
      if (gamesThenRes.error) throw gamesThenRes.error
      if (eventsThenRes.error) throw eventsThenRes.error

      return {
        totalGames: gamesRes.count ?? 0,
        totalEvents: eventsRes.count ?? 0,
        activeEvents: activeRes.count ?? 0,
        upcomingEvents: readyRes.count ?? 0,
        gamesDelta: (gamesRes.count ?? 0) - (gamesThenRes.count ?? 0),
        totalEventsDelta: (eventsRes.count ?? 0) - (eventsThenRes.count ?? 0),
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

/** ISO timestamp for the start of the trailing activity window. */
function windowStartISO(): string {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1))
  start.setUTCHours(0, 0, 0, 0)
  return start.toISOString()
}

export function useActivitySeries(
  organizationId: string | null,
  metric: ActivityMetric,
) {
  return useQuery({
    queryKey: queryKeys.activitySeries(organizationId, metric),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ActivityPoint[]> => {
      if (!organizationId) return []

      // `submissions` has no organization_id, so scope via the events join.
      const { data, error } = await supabase
        .from('submissions')
        .select('created_at, team_id, events!inner(organization_id)')
        .eq('events.organization_id', organizationId)
        .gte('created_at', windowStartISO())

      if (error) throw error

      const rows = (data ?? []).map((row) => ({
        created_at: row.created_at as string,
        team_id: row.team_id as string,
      }))

      return bucketActivity(rows, metric, new Date())
    },
  })
}

export function useGameTypeBreakdown(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.gameTypeBreakdown(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<GameTypeCount[]> => {
      if (!organizationId) return []

      // The hand-authored DB types declare no submissions-to-games relation,
      // so the game type is resolved client-side from the org's game list
      // rather than through an embedded select.
      const [submissionsRes, gamesRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('game_id, events!inner(organization_id)')
          .eq('events.organization_id', organizationId)
          .gte('created_at', windowStartISO()),
        supabase
          .from('games')
          .select('id, type')
          .eq('organization_id', organizationId),
      ])

      if (submissionsRes.error) throw submissionsRes.error
      if (gamesRes.error) throw gamesRes.error

      const typeByGameId = new Map<string, GameType>(
        (gamesRes.data ?? []).map((game) => [game.id, game.type]),
      )

      const rows = (submissionsRes.data ?? [])
        .map((row) => {
          const type = typeByGameId.get(row.game_id)
          return type ? { type } : null
        })
        .filter((row): row is { type: GameType } => row !== null)

      return tallyGameTypes(rows)
    },
  })
}
