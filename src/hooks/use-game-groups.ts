import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type GameGroupRow = Tables<'game_groups'>
export type GameGroupItemRow = Tables<'game_group_items'>

export type GameGroupWithItems = GameGroupRow & {
  items: { game_id: string }[]
}

export function useGameGroups(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.gameGroups(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<GameGroupWithItems[]> => {
      if (!organizationId) return []

      const { data: groups, error: gErr } = await supabase
        .from('game_groups')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      if (gErr) throw gErr
      if (!groups?.length) return []

      const { data: items, error: iErr } = await supabase
        .from('game_group_items')
        .select('group_id, game_id')
        .in(
          'group_id',
          groups.map((g) => g.id),
        )

      if (iErr) throw iErr

      return groups.map((g) => ({
        ...g,
        items: (items ?? []).filter((i) => i.group_id === g.id),
      }))
    },
  })
}

export function useRenameGameGroup(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      name,
    }: {
      groupId: string
      name: string
    }) => {
      const { error } = await supabase
        .from('game_groups')
        .update({ name: name.trim() })
        .eq('id', groupId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gameGroups(organizationId),
      })
    },
  })
}

export function useDeleteGameGroup(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error: itemsError } = await supabase
        .from('game_group_items')
        .delete()
        .eq('group_id', groupId)

      if (itemsError) throw itemsError

      const { error } = await supabase.from('game_groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gameGroups(organizationId),
      })
    },
  })
}

/**
 * Adds games to a group, leaving whatever other groups they are already in.
 *
 * The group dialogs used to clear every membership before inserting, so "add
 * these to Puzzles" quietly pulled the games out of the groups they were
 * already in. The game editor's own checkboxes
 * have always been additive, so the two surfaces disagreed about what a group
 * is. This is the additive one.
 *
 * Duplicate memberships are ignored rather than treated as errors: adding a
 * game that is already in the group should be a no-op, not a failure.
 */
export function useAddGamesToGroup(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ gameIds, groupId }: { gameIds: string[]; groupId: string }) => {
      if (gameIds.length === 0) return
      const { error } = await supabase
        .from('game_group_items')
        .upsert(
          gameIds.map((gameId) => ({ group_id: groupId, game_id: gameId })),
          { onConflict: 'group_id,game_id', ignoreDuplicates: true },
        )
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gameGroups(organizationId),
      })
    },
  })
}

/**
 * Sets the full list of groups a game belongs to.
 *
 * The data model (game_group_items) has always been many-to-many;
 * the old single-group behaviour was a limitation of the card control, not of
 * the schema. This writes the whole set so a game can sit in several groups.
 */
export function useSetGameGroups(organizationId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ gameId, groupIds }: { gameId: string; groupIds: string[] }) => {
      const { error: clearError } = await supabase
        .from('game_group_items')
        .delete()
        .eq('game_id', gameId)
      if (clearError) throw clearError

      if (groupIds.length > 0) {
        const { error } = await supabase
          .from('game_group_items')
          .insert(groupIds.map((groupId) => ({ group_id: groupId, game_id: gameId })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gameGroups(organizationId),
      })
    },
  })
}
