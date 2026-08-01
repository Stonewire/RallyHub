import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { buildDuplicateEventPayload } from '@/lib/duplicate-event'
import { capTeamCountForEventStatus } from '@/lib/event-demo'
import { resetEventData } from '@/lib/reset-event-data'
import { formatSupabaseError, logSupabaseFailure } from '@/lib/supabase-errors'
import { syncEventGameLinks } from '@/lib/sync-event-game-links'
import { syncTeamSlots } from '@/lib/sync-team-slots'
import { supabase } from '@/lib/supabase'
import type { EventStatus } from '@/types/database'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type EventRow = Tables<'events'>

export const STATUS_ORDER: EventStatus[] = ['active', 'demo', 'ready', 'draft', 'archived']

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  active: 'Active',
  demo: 'Demo',
  ready: 'Ready',
  draft: 'Draft',
  archived: 'Archived',
}

/**
 * Solid pill per status, from the design: the whole pill carries the colour
 * rather than a dot beside a neutral chip. Fixed colours, not theme tokens,
 * because the meaning of green/blue/yellow must not flip between light and dark.
 */
export const EVENT_STATUS_PILL_CLASS: Record<EventStatus, string> = {
  active: 'bg-[#2f9e6e] text-white border-transparent hover:bg-[#2f9e6e] hover:text-white',
  demo: 'bg-[#bfe0f5] text-[#1c3d52] border-transparent hover:bg-[#bfe0f5] hover:text-[#1c3d52]',
  ready: 'bg-[#ffc107] text-[#3a2f00] border-transparent hover:bg-[#ffc107] hover:text-[#3a2f00]',
  draft: 'bg-[#dcdcdf] text-[#3a3a3f] border-transparent hover:bg-[#dcdcdf] hover:text-[#3a3a3f]',
  archived: 'bg-[#4a4a4f] text-white border-transparent hover:bg-[#4a4a4f] hover:text-white',
}

export function groupEventsByStatus(events: EventRow[]) {
  return STATUS_ORDER.map((status) => ({
    status,
    label: EVENT_STATUS_LABELS[status],
    events: events.filter((e) => e.status === status),
  })).filter((group) => group.events.length > 0)
}

export function useEvents(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.events(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<EventRow[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', organizationId)
        .is('wiped_at', null)
        .is('deleted_at', null)
        .order('list_order', { ascending: true })
        .order('event_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useTrashedEvents(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.trashedEvents(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<EventRow[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', organizationId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.event(eventId ?? ''),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventRow> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId!)
        .single()

      if (error) throw error
      return data
    },
  })
}

export function useEventGameIds(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.eventGames(eventId ?? ''),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('event_games')
        .select('game_id')
        .eq('event_id', eventId!)

      if (error) throw error
      return (data ?? []).map((r) => r.game_id)
    },
  })
}

export function useUpdateEvent(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      event,
      gameIds,
    }: {
      eventId: string
      event: TablesUpdate<'events'>
      gameIds: string[]
    }) => {
      const { data: updated, error: updateError } = await supabase
        .from('events')
        .update(event)
        .eq('id', eventId)
        .select('id')
        .maybeSingle()

      if (updateError) {
        logSupabaseFailure('events.update', updateError)
        throw new Error(formatSupabaseError(updateError))
      }
      if (!updated) {
        const msg =
          'Event was not updated (no matching row or permission denied). Client admins: confirm this event belongs to your organization. Super admins: run migration 036_events_super_admin_update.sql in Supabase.'
        logSupabaseFailure('events.update', msg)
        throw new Error(msg)
      }

      const { data: eventMeta, error: metaError } = await supabase
        .from('events')
        .select('organization_id')
        .eq('id', eventId)
        .single()

      if (metaError) {
        logSupabaseFailure('events.select organization_id', metaError)
        throw new Error(formatSupabaseError(metaError))
      }

      await syncEventGameLinks(eventId, eventMeta.organization_id, gameIds)

      if (event.team_count != null) {
        const { data: current, error: fetchErr } = await supabase
          .from('events')
          .select('status')
          .eq('id', eventId)
          .single()
        if (fetchErr) {
          logSupabaseFailure('events.select status', fetchErr)
          throw new Error(formatSupabaseError(fetchErr))
        }

        const teamCount = capTeamCountForEventStatus(
          event.team_count,
          (event.status ?? current?.status) as EventStatus,
        )
        if (teamCount !== event.team_count) {
          const { error: capError } = await supabase
            .from('events')
            .update({ team_count: teamCount })
            .eq('id', eventId)
          if (capError) {
            logSupabaseFailure('events.update team_count cap', capError)
            throw new Error(formatSupabaseError(capError))
          }
        }
        await syncTeamSlots(eventId, teamCount)
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.event(variables.eventId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.eventGames(variables.eventId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}

export function useCreateEvent(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      event,
      gameIds,
    }: {
      event: TablesInsert<'events'>
      gameIds: string[]
    }) => {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single()

      if (error) throw error

      if (gameIds.length > 0) {
        const { error: linkError } = await supabase.from('event_games').insert(
          gameIds.map((game_id) => ({
            event_id: data.id,
            game_id,
          })),
        )
        if (linkError) throw linkError
      }

      await syncTeamSlots(data.id, data.team_count)

      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}

export function useDeleteEvent(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trashedEvents(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}

export function useRestoreEvent(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: null })
        .eq('id', eventId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trashedEvents(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}

export function useResetEventData(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => resetEventData(eventId),
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.event(eventId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}

export function useUpdateEventStatus(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string
      status: EventStatus
    }) => {
      if (status === 'demo') {
        const { data: event, error: fetchErr } = await supabase
          .from('events')
          .select('team_count')
          .eq('id', eventId)
          .single()
        if (fetchErr) throw fetchErr

        const teamCount = capTeamCountForEventStatus(event?.team_count ?? 2, 'demo')
        const { error } = await supabase
          .from('events')
          .update({ status, team_count: teamCount })
          .eq('id', eventId)
        if (error) throw error
        await syncTeamSlots(eventId, teamCount)
        return
      }

      const { error } = await supabase
        .from('events')
        .update({ status })
        .eq('id', eventId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.event(variables.eventId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}

export function useDuplicateEvent(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      source,
      gameIds,
    }: {
      source: EventRow
      gameIds: string[]
    }) => {
      const { event, gameIds: linkedGameIds } = buildDuplicateEventPayload(
        source,
        gameIds,
      )

      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single()

      if (error) throw error

      if (linkedGameIds.length > 0) {
        const { error: linkError } = await supabase.from('event_games').insert(
          linkedGameIds.map((game_id) => ({
            event_id: data.id,
            game_id,
          })),
        )
        if (linkError) throw linkError
      }

      await syncTeamSlots(data.id, data.team_count)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recentEvents(organizationId),
      })
    },
  })
}
