import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { EventTaskStatus } from '@/types/database'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type EventTaskRow = Tables<'event_tasks'>

export const EVENT_TASK_STATUS_ORDER: EventTaskStatus[] = [
  'todo',
  'in_progress',
  'blocked',
  'done',
]

export const EVENT_TASK_STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}

/** Solid pills; dark: variants baked in for the outline-Button dropdown trigger. */
export const EVENT_TASK_STATUS_PILL_CLASS: Record<EventTaskStatus, string> = {
  todo:
    'bg-[#dcdcdf] text-[#3a3a3f] hover:bg-[#d0d0d4] dark:bg-[#3a3d44] dark:text-[#d7d9dd] dark:hover:bg-[#42454d]',
  in_progress: 'bg-[var(--nm-yellow)] text-[#3a2f00] hover:bg-[#ecb100] dark:hover:bg-[#ecb100]',
  blocked: 'bg-[#d64545] text-white hover:bg-[#c23c3c] dark:hover:bg-[#c23c3c]',
  done: 'bg-[#2f9e6e] text-white hover:bg-[#2a8c62] dark:hover:bg-[#2a8c62]',
}

export function useEventTasks(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.eventTasks(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventTaskRow[]> => {
      if (!eventId) return []
      const { data, error } = await supabase
        .from('event_tasks')
        .select('*')
        .eq('event_id', eventId)
        .order('list_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export type SaveEventTaskInput = {
  id?: string
  name: string
  assignee: string | null
  description: string | null
  /** ISO date string (yyyy-mm-dd) or null. */
  dueDate: string | null
  status: EventTaskStatus
}

export function useSaveEventTask(
  organizationId: string | null,
  eventId: string | undefined,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveEventTaskInput) => {
      if (!organizationId || !eventId) throw new Error('No event selected.')
      if (input.id) {
        const update: TablesUpdate<'event_tasks'> = {
          name: input.name.trim(),
          assignee: input.assignee?.trim() || null,
          description: input.description?.trim() || null,
          due_date: input.dueDate || null,
          status: input.status,
        }
        const { data, error } = await supabase
          .from('event_tasks')
          .update(update)
          .eq('id', input.id)
          .select()
          .single()
        if (error) throw error
        return data
      }
      const insert: TablesInsert<'event_tasks'> = {
        event_id: eventId,
        organization_id: organizationId,
        name: input.name.trim(),
        assignee: input.assignee?.trim() || null,
        description: input.description?.trim() || null,
        due_date: input.dueDate || null,
        status: input.status,
      }
      const { data, error } = await supabase
        .from('event_tasks')
        .insert(insert)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTasks(eventId) })
    },
  })
}

export function useDeleteEventTask(eventId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.eventTasks(eventId) })
    },
  })
}
