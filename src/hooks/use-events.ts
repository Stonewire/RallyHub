import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { buildDuplicateEventPayload } from '@/lib/duplicate-event'
import { syncTeamSlots } from '@/lib/sync-team-slots'
import { supabase } from '@/lib/supabase'
import type { EventStatus } from '@/types/database'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type EventRow = Tables<'events'>

export const STATUS_ORDER: EventStatus[] = ['active', 'ready', 'draft', 'archived']

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  active: 'Active',
  ready: 'Ready',
  draft: 'Draft',
  archived: 'Archived',
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
        .order('list_order', { ascending: true })
        .order('event_date', { ascending: true, nullsFirst: false })

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
      const { error } = await supabase
        .from('events')
        .update(event)
        .eq('id', eventId)

      if (error) throw error

      const { error: delError } = await supabase
        .from('event_games')
        .delete()
        .eq('event_id', eventId)

      if (delError) throw delError

      if (gameIds.length > 0) {
        const { error: linkError } = await supabase.from('event_games').insert(
          gameIds.map((game_id) => ({
            event_id: eventId,
            game_id,
          })),
        )
        if (linkError) throw linkError
      }

      if (event.team_count != null) {
        await syncTeamSlots(eventId, event.team_count)
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
      const { error } = await supabase.from('events').delete().eq('id', eventId)
      if (error) throw error
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

export function useReorderEvents(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
      listOrder,
    }: {
      eventId: string
      status: EventStatus
      listOrder: number
    }) => {
      const { error } = await supabase
        .from('events')
        .update({ status, list_order: listOrder })
        .eq('id', eventId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events(organizationId),
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

export function nextEventStatus(current: EventStatus): EventStatus {
  const idx = STATUS_ORDER.indexOf(current)
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? 'draft'
}
