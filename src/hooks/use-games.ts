import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { GameType } from '@/types/database'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type GameRow = Tables<'games'>

function invalidateGameListQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string | null,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.games(organizationId),
  })
  void queryClient.invalidateQueries({
    queryKey: queryKeys.platformLibraryGames(),
  })
  void queryClient.invalidateQueries({
    queryKey: ['rallyhub', 'platform-games'],
  })
}

export function useAdminGames(
  organizationId: string | null,
  isPlatformLibrary: boolean,
) {
  return useQuery({
    queryKey: isPlatformLibrary
      ? queryKeys.platformLibraryGames()
      : queryKeys.games(organizationId),
    enabled: isPlatformLibrary ? true : Boolean(organizationId),
    queryFn: async (): Promise<GameRow[]> => {
      let query = supabase.from('games').select('*')

      if (isPlatformLibrary) {
        query = query.eq('is_platform_template', true)
      } else {
        if (!organizationId) return []
        query = query.eq('organization_id', organizationId)
      }

      const { data, error } = await query
        .order('list_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

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
        .order('list_order', { ascending: true })
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
      invalidateGameListQueries(queryClient, organizationId)
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
      invalidateGameListQueries(queryClient, organizationId)
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
      invalidateGameListQueries(queryClient, organizationId)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gameGroups(organizationId),
      })
    },
  })
}

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  photo: 'Photo',
  video: 'Video',
  text: 'Text',
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

export function useGame(gameId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.game(gameId),
    enabled: Boolean(gameId),
    queryFn: async (): Promise<GameRow | null> => {
      if (!gameId) return null
      const { data, error } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateGame(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      gameId,
      patch,
    }: {
      gameId: string
      patch: TablesUpdate<'games'>
    }) => {
      const { data, error } = await supabase
        .from('games')
        .update(patch)
        .eq('id', gameId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { gameId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) })
      invalidateGameListQueries(queryClient, organizationId)
    },
  })
}

export function useReorderGames(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, list_order) =>
        supabase.from('games').update({ list_order }).eq('id', id),
      )
      const results = await Promise.all(updates)
      const err = results.find((r) => r.error)?.error
      if (err) throw err
    },
    onSuccess: () => {
      invalidateGameListQueries(queryClient, organizationId)
    },
  })
}
