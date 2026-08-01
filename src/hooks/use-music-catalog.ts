import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query-keys'
import {
  bingoGamesReferencingCatalogTrack,
  deleteMusicCatalogAudioFiles,
} from '@/lib/music-catalog-utils'
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

export function useUpdateMusicCatalog(organizationId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    // Every field is optional so the same mutation covers both the edit dialog
    // and a one-field write like marking the clip in point.
    mutationFn: async ({
      id,
      title,
      artist,
      genre,
      clip_in_point_seconds,
    }: {
      id: string
      title?: string
      artist?: string
      genre?: string | null
      clip_in_point_seconds?: number | null
    }) => {
      const { error } = await supabase
        .from('music_catalog')
        .update({
          ...(title !== undefined ? { title: title.trim() } : {}),
          ...(artist !== undefined ? { artist: artist.trim() } : {}),
          ...(genre !== undefined ? { genre: genre?.trim() || null } : {}),
          ...(clip_in_point_seconds !== undefined ? { clip_in_point_seconds } : {}),
        })
        .eq('id', id)
      if (error) throw error
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
    mutationFn: async (row: MusicCatalogRow) => {
      if (!organizationId) throw new Error('No organization')

      const refs = await bingoGamesReferencingCatalogTrack(organizationId, row.id)
      if (refs.length > 0) {
        const names = refs.map((g) => g.name).join(', ')
        throw new Error(
          `This track is used in bingo game${refs.length > 1 ? 's' : ''}: ${names}. Remove it from those games first.`,
        )
      }

      const { error } = await supabase.from('music_catalog').delete().eq('id', row.id)
      if (error) throw error

      try {
        await deleteMusicCatalogAudioFiles(row)
      } catch (storageErr) {
        console.warn('[RallyHub] catalog row deleted but storage cleanup failed', storageErr)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.musicCatalog(organizationId),
      })
    },
  })
}
