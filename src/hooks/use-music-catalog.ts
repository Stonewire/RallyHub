import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/helpers'

export type MusicCatalogRow = Tables<'music_catalog'>

export function useMusicCatalog(organizationId: string | null) {
  return useQuery({
    queryKey: queryKeys.musicCatalog(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<MusicCatalogRow[]> => {
      if (!organizationId) return []
      const { data, error } = await supabase
        .from('music_catalog')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useInsertMusicCatalog(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (row: TablesInsert<'music_catalog'>) => {
      const { data, error } = await supabase
        .from('music_catalog')
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.musicCatalog(organizationId),
      })
    },
  })
}

export function useDeleteMusicCatalog(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('music_catalog').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.musicCatalog(organizationId),
      })
    },
  })
}
