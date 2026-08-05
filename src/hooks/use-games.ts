import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { profileDisplayName } from '@/lib/auth-routes'
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
      let query = supabase.from('games').select('*').is('deleted_at', null)

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
        .is('deleted_at', null)
        .order('list_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useTrashedGames(organizationId: string | null, isPlatformLibrary: boolean) {
  return useQuery({
    queryKey: queryKeys.trashedGames(organizationId),
    enabled: isPlatformLibrary ? true : Boolean(organizationId),
    queryFn: async (): Promise<GameRow[]> => {
      let query = supabase.from('games').select('*').not('deleted_at', 'is', null)

      if (isPlatformLibrary) {
        query = query.eq('is_platform_template', true)
      } else {
        if (!organizationId) return []
        query = query.eq('organization_id', organizationId)
      }

      const { data, error } = await query.order('deleted_at', { ascending: false })
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

/**
 * Copies a game into the same organisation.
 *
 * Config is copied wholesale, so a quiz keeps its questions and a bingo game
 * its tracks. The copy starts as a draft and out of every group: it is a
 * starting point for editing, and dropping it into the original's groups would
 * quietly change what those groups contain. Cover and media URLs are shared
 * with the original rather than re-uploaded, since nothing here mutates a
 * stored file in place.
 */
export function useDuplicateGame(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (game: GameRow) => {
      if (!organizationId) throw new Error('No organization selected.')
      const insert: TablesInsert<'games'> = {
        organization_id: organizationId,
        name: `${game.name} (copy)`.slice(0, 120),
        type: game.type,
        description: game.description,
        cover_url: game.cover_url,
        config: game.config,
        points_type: game.points_type,
        points_static: game.points_static,
        points_min: game.points_min,
        points_max: game.points_max,
        solution_description: game.solution_description,
        solution_image_url: game.solution_image_url,
        status: 'draft',
        // A duplicate belongs to the organisation that made it, never to the
        // shared platform library, whatever the original was.
        is_platform_template: false,
      }
      const { data, error } = await supabase
        .from('games')
        .insert(insert)
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
      // Record who binned it, and snapshot their name so the Deleted Games
      // list can still attribute it after that account is removed.
      const { data: auth } = await supabase.auth.getUser()
      const actorId = auth.user?.id ?? null
      let actorName: string | null = null
      if (actorId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, full_name, username')
          .eq('id', actorId)
          .maybeSingle()
        actorName = profileDisplayName(profile) || null
      }

      const { error } = await supabase
        .from('games')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          deleted_by_name: actorName,
        })
        .eq('id', gameId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateGameListQueries(queryClient, organizationId)
      void queryClient.invalidateQueries({ queryKey: queryKeys.trashedGames(organizationId) })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
    },
  })
}

export function useRestoreGame(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase
        .from('games')
        .update({ deleted_at: null })
        .eq('id', gameId)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateGameListQueries(queryClient, organizationId)
      void queryClient.invalidateQueries({ queryKey: queryKeys.trashedGames(organizationId) })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboardStats(organizationId),
      })
    },
  })
}

/**
 * Hard-deletes a game that is already in Deleted Games.
 *
 * Goes through the permanently_delete_game RPC rather than a direct delete,
 * because submissions.game_id cascades: a plain delete would silently destroy
 * every submission ever made for that game. The RPC refuses in that case and
 * returns a message explaining why, which is surfaced to the organiser.
 */
export function usePermanentlyDeleteGame(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.rpc('permanently_delete_game', { p_game_id: gameId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidateGameListQueries(queryClient, organizationId)
      void queryClient.invalidateQueries({ queryKey: queryKeys.trashedGames(organizationId) })
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
  puzzle: 'Puzzle',
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
