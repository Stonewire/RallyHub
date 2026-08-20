import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { profileDisplayName } from '@/lib/auth-routes'
import { i18n } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { GamePrepStatus, GameType } from '@/types/database'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type GameRow = Tables<'games'>

/** Order 'sort by status' surfaces first: work-needed statuses lead, done trails. */
export const GAME_PREP_STATUS_ORDER: GamePrepStatus[] = [
  'needs_attention',
  'in_progress',
  'draft',
  'done',
]

/**
 * i18n keys, not text: the label must re-resolve after a language change, so
 * consumers call the component's own t() or gamePrepStatusLabel() below.
 */
export const GAME_PREP_STATUS_LABEL_KEYS: Record<GamePrepStatus, string> = {
  draft: 'games.prepStatus.draft',
  in_progress: 'games.prepStatus.inProgress',
  done: 'games.prepStatus.done',
  needs_attention: 'games.prepStatus.needsAttention',
}

/** For callers with no t() in scope. Resolves at call time, never at import. */
export function gamePrepStatusLabel(status: GamePrepStatus): string {
  return i18n.t(`admin:${GAME_PREP_STATUS_LABEL_KEYS[status]}`)
}

/**
 * Solid pills that sit on shadcn's outline Button trigger, so dark: variants are
 * baked in (the button's own dark:bg-input/30 otherwise wins and leaves the label
 * illegible). Mirrors EVENT_STATUS_PILL_CLASS in use-events.ts.
 */
export const GAME_PREP_STATUS_PILL_CLASS: Record<GamePrepStatus, string> = {
  draft:
    'bg-[#dcdcdf] text-[#3a3a3f] hover:bg-[#d0d0d4] dark:bg-[#3a3d44] dark:text-[#d7d9dd] dark:hover:bg-[#42454d]',
  in_progress: 'bg-[var(--nm-yellow)] text-[#3a2f00] hover:bg-[#ecb100] dark:hover:bg-[#ecb100]',
  done: 'bg-[#2f9e6e] text-white hover:bg-[#2a8c62] dark:hover:bg-[#2a8c62]',
  needs_attention: 'bg-[#d64545] text-white hover:bg-[#c23c3c] dark:hover:bg-[#c23c3c]',
}

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

/**
 * i18n keys, not text: the tag must re-resolve after a language change, so
 * consumers call the component's own t() or gameTypeLabel() below.
 */
export const GAME_TYPE_LABEL_KEYS: Record<GameType, string> = {
  photo: 'games.types.photo',
  video: 'games.types.video',
  text: 'games.types.text',
  quiz: 'games.types.quiz',
  music_bingo: 'games.types.musicBingo',
  puzzle: 'games.types.puzzle',
}

/** For callers with no t() in scope. Resolves at call time, never at import. */
export function gameTypeLabel(type: GameType): string {
  return i18n.t(`admin:${GAME_TYPE_LABEL_KEYS[type]}`)
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

export function useUpdateGamePrepStatus(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      gameId,
      prepStatus,
    }: {
      gameId: string
      prepStatus: GamePrepStatus
    }) => {
      const { error } = await supabase
        .from('games')
        .update({ prep_status: prepStatus })
        .eq('id', gameId)
      if (error) throw error
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
