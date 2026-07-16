import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { deleteStorageObjects, publicUrlStoragePath, uploadAsset } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type InventoryItem = Tables<'inventory_items'>

export function useInventoryItems(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.inventoryItems(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<InventoryItem[]> => {
      if (!organizationId) return []
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export type SaveInventoryItemInput = {
  id?: string
  name: string
  description: string | null
  pointsCost: number
  image?: File | null
  removeImage?: boolean
}

export function useSaveInventoryItem(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveInventoryItemInput) => {
      if (!organizationId) throw new Error('No organization selected.')
      const id = input.id ?? crypto.randomUUID()
      let imageUrl: string | null | undefined
      let oldImageUrl: string | null = null
      let saved = false

      if (input.id) {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('image_url')
          .eq('id', input.id)
          .single()
        if (error) throw error
        oldImageUrl = data.image_url
      }

      if (input.image) {
        const extension = input.image.name.split('.').pop()?.toLowerCase() || 'jpg'
        imageUrl = await uploadAsset(
          'game-assets',
          `${organizationId}/inventory/${id}/${crypto.randomUUID()}.${extension}`,
          input.image,
          { mediaKind: 'photo' },
        )
      } else if (input.removeImage) {
        imageUrl = null
      }

      try {
        if (input.id) {
          const update: TablesUpdate<'inventory_items'> = {
            name: input.name.trim(),
            description: input.description?.trim() || null,
            points_cost: input.pointsCost,
            ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
          }
          const { data, error } = await supabase
            .from('inventory_items')
            .update(update)
            .eq('id', input.id)
            .select()
            .single()
          if (error) throw error
          saved = true
          return data
        }

        const insert: TablesInsert<'inventory_items'> = {
          id,
          organization_id: organizationId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          points_cost: input.pointsCost,
          image_url: imageUrl ?? null,
        }
        const { data, error } = await supabase
          .from('inventory_items')
          .insert(insert)
          .select()
          .single()
        if (error) throw error
        saved = true
        return data
      } catch (error) {
        if (imageUrl && imageUrl !== oldImageUrl) {
          const path = publicUrlStoragePath(imageUrl, 'game-assets')
          if (path) {
            void deleteStorageObjects('game-assets', [path]).catch((reason) =>
              console.warn('[RallyHub] inventory image rollback cleanup failed', reason),
            )
          }
        }
        throw error
      } finally {
        if (saved && oldImageUrl && imageUrl !== undefined && oldImageUrl !== imageUrl) {
          const path = publicUrlStoragePath(oldImageUrl, 'game-assets')
          if (path) {
            void deleteStorageObjects('game-assets', [path]).catch((reason) =>
              console.warn('[RallyHub] old inventory image cleanup failed', reason),
            )
          }
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems(organizationId) })
    },
  })
}

export function useDeleteInventoryItem(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: InventoryItem) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
      if (error) throw error
      if (item.image_url) {
        const path = publicUrlStoragePath(item.image_url, 'game-assets')
        if (path) {
          try {
            await deleteStorageObjects('game-assets', [path])
          } catch (reason) {
            console.warn('[RallyHub] inventory item deleted but image cleanup failed', reason)
          }
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems(organizationId) })
    },
  })
}
