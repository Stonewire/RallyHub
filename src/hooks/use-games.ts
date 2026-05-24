import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { GameType } from '@/types/database'
import type { Tables, TablesInsert } from '@/types/helpers'

export type GameRow = Tables<'games'>

export function useGames(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.games(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<GameRow[]> => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateGame(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TablesInsert<'games'>) => {
      const { data, error } = await supabase
        .from('games')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.games(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
    },
  })
}

export function useDeleteGame(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.from('games').delete().eq('id', gameId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.games(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
    },
  })
}

export function useCreateGameGroup(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      if (!organizationId) throw new Error('No organization')

      const { data, error } = await supabase
        .from('game_groups')
        .insert({ organization_id: organizationId, name })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.games(organizationId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gameGroups(organizationId),
      })
    },
  })
}

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  photo: 'Photo',
  video: 'Video',
  quiz: 'Quiz',
  music_bingo: 'Music Bingo',
}

export function gameStatusTone(
  status: string,
): 'active' | 'draft' | 'ready' | 'archived' {
  if (status === 'active') return 'active'
  if (status === 'ready') return 'ready'
  if (status === 'archived') return 'archived'
  return 'draft'
}
