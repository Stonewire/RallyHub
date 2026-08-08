import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { publishLiveBundlePatch } from '@/lib/live-broadcast'
import { queryKeys } from '@/lib/query-keys'
import { deleteStorageObjects, publicUrlStoragePath, uploadAsset } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/helpers'

export type InventoryItem = Tables<'inventory_items'>
export type InventoryPurchase = Tables<'inventory_purchases'>

export function useEventInventoryPurchases(eventId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.inventoryPurchases(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<InventoryPurchase[]> => {
      if (!eventId) return []
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!eventId) return
    const channel = supabase
      .channel(`inventory-purchases:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_purchases',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const purchase = payload.new as InventoryPurchase
          queryClient.setQueryData<InventoryPurchase[]>(
            queryKeys.inventoryPurchases(eventId),
            (current = []) =>
              current.some((row) => row.id === purchase.id)
                ? current
                : [purchase, ...current],
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId, queryClient])

  return query
}

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

/**
 * Copies an item, including its photo.
 *
 * The photo is copied in storage rather than shared: two rows pointing at one
 * file means deleting either item takes the picture off the other. The copy
 * gets its own public_code from the column default, so it is a distinct QR.
 */
export function useDuplicateInventoryItem(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: InventoryItem) => {
      if (!organizationId) throw new Error('No organization selected.')
      const id = crypto.randomUUID()
      let imageUrl: string | null = null

      const sourcePath = item.image_url
        ? publicUrlStoragePath(item.image_url, 'game-assets')
        : null
      if (sourcePath) {
        const extension = sourcePath.split('.').pop()?.toLowerCase() || 'jpg'
        const targetPath = `${organizationId}/inventory/${id}/${crypto.randomUUID()}.${extension}`
        const { error: copyError } = await supabase.storage
          .from('game-assets')
          .copy(sourcePath, targetPath)
        // A missing source file must not block the duplicate; the copy simply
        // comes through without a photo.
        if (!copyError) {
          imageUrl = supabase.storage.from('game-assets').getPublicUrl(targetPath).data.publicUrl
        }
      }

      const insert: TablesInsert<'inventory_items'> = {
        id,
        organization_id: organizationId,
        name: `${item.name} (copy)`.slice(0, 120),
        description: item.description,
        points_cost: item.points_cost,
        image_url: imageUrl,
      }
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(insert)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems(organizationId) })
    },
  })
}

export type InventoryOrder = Tables<'inventory_orders'> & {
  inventory_order_items: Tables<'inventory_order_items'>[]
}

/**
 * Store orders for the facilitator's fulfilment panel, live: the orders table
 * is in the realtime publication, and any change simply refetches — orders
 * are rare enough that merging patches by hand would be complexity for
 * nothing.
 */
export function useEventStoreOrders(eventId: string | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.inventoryOrders(eventId),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<InventoryOrder[]> => {
      if (!eventId) return []
      const { data, error } = await supabase
        .from('inventory_orders')
        .select('*, inventory_order_items(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
      if (error) throw error
      // Hand-authored types carry no FK metadata, so the embedded relation
      // needs a cast; the runtime shape is exactly InventoryOrder.
      return (data ?? []) as unknown as InventoryOrder[]
    },
  })

  useEffect(() => {
    if (!eventId) return
    const channel = supabase
      .channel(`inventory-orders:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_orders', filter: `event_id=eq.${eventId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryOrders(eventId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [eventId, queryClient])

  return query
}

export function useFulfilOrderItem(eventId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orderItemId: string; fulfilled: boolean }) => {
      const { error } = await supabase.rpc('fulfil_store_order_item', {
        p_order_item_id: input.orderItemId,
        p_fulfilled: input.fulfilled,
      })
      if (error) throw error
    },
    // Flip the tick in the cache immediately: waiting on a refetch made every
    // checkbox in the dialog flicker on each tick (CF3-12).
    onMutate: async (input) => {
      const key = queryKeys.inventoryOrders(eventId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<InventoryOrder[]>(key)
      queryClient.setQueryData<InventoryOrder[]>(key, (orders = []) =>
        orders.map((order) => ({
          ...order,
          inventory_order_items: order.inventory_order_items.map((item) =>
            item.id === input.orderItemId ? { ...item, fulfilled: input.fulfilled } : item,
          ),
        })),
      )
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.inventoryOrders(eventId), context.previous)
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryOrders(eventId) }),
  })
}

export function useCompleteStoreOrder(eventId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('complete_store_order', {
        p_order_id: orderId,
      })
      if (error) throw error
      const result = data?.[0] ?? null
      // The RPC changed teams.score in SQL, which no live channel carries to
      // player devices; broadcast the fresh team row so their header updates
      // without a refresh (CF3-13).
      if (result && eventId) {
        const { data: team } = await supabase
          .from('teams')
          .select('*')
          .eq('id', result.team_id)
          .single()
        if (team) {
          void publishLiveBundlePatch(eventId, { kind: 'team', op: 'UPDATE', row: team })
        }
      }
      return result
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryOrders(eventId) }),
  })
}

export function useCancelStoreOrder(eventId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('cancel_store_order', { p_order_id: orderId })
      if (error) throw error
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryOrders(eventId) }),
  })
}
