import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type InventoryGroupRow = Tables<'inventory_groups'>

export type InventoryGroupWithItems = InventoryGroupRow & {
  itemIds: string[]
}

/** Groups plus their membership, same shape as the game groups hook. */
export function useInventoryGroups(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.inventoryGroups(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<InventoryGroupWithItems[]> => {
      if (!organizationId) return []

      const { data: groups, error: groupsError } = await supabase
        .from('inventory_groups')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })
      if (groupsError) throw groupsError
      if (!groups?.length) return []

      const { data: items, error: itemsError } = await supabase
        .from('inventory_group_items')
        .select('group_id, item_id')
        .in(
          'group_id',
          groups.map((group) => group.id),
        )
      if (itemsError) throw itemsError

      return groups.map((group) => ({
        ...group,
        itemIds: (items ?? [])
          .filter((row) => row.group_id === group.id)
          .map((row) => row.item_id),
      }))
    },
  })
}

export function useCreateInventoryGroup(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, itemIds }: { name: string; itemIds: string[] }) => {
      if (!organizationId) throw new Error('No organization selected.')
      // Created first, then filled, so a failure on the membership insert still
      // leaves a usable (empty) group rather than nothing at all.
      const { data, error } = await supabase
        .from('inventory_groups')
        .insert({ organization_id: organizationId, name: name.trim() })
        .select()
        .single()
      if (error) throw error

      if (itemIds.length > 0) {
        const { error: linkError } = await supabase
          .from('inventory_group_items')
          .insert(itemIds.map((item_id) => ({ group_id: data.id, item_id })))
        if (linkError) throw linkError
      }
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryGroups(organizationId),
      })
    },
  })
}

export function useRenameInventoryGroup(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, name }: { groupId: string; name: string }) => {
      const { error } = await supabase
        .from('inventory_groups')
        .update({ name: name.trim() })
        .eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryGroups(organizationId),
      })
    },
  })
}

/** Deletes the group only. Membership rows cascade; the items are untouched. */
export function useDeleteInventoryGroup(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from('inventory_groups').delete().eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryGroups(organizationId),
      })
    },
  })
}

/** Replaces the set of groups one item belongs to. */
export function useSetItemGroups(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, groupIds }: { itemId: string; groupIds: string[] }) => {
      const { error: clearError } = await supabase
        .from('inventory_group_items')
        .delete()
        .eq('item_id', itemId)
      if (clearError) throw clearError

      if (groupIds.length > 0) {
        const { error } = await supabase
          .from('inventory_group_items')
          .insert(groupIds.map((group_id) => ({ group_id, item_id: itemId })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventoryGroups(organizationId),
      })
    },
  })
}
