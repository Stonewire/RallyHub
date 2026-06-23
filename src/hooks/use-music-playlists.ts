import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/helpers'

export type MusicPlaylistRow = Tables<'music_playlists'>

const playlistsKey = (orgId: string | null) => ['music-playlists', orgId]
const playlistTracksKey = (orgId: string | null) => ['music-playlist-tracks', orgId]

export function useMusicPlaylists(organizationId: string | null) {
  return useQuery({
    queryKey: playlistsKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<MusicPlaylistRow[]> => {
      if (!organizationId) return []
      const { data, error } = await supabase
        .from('music_playlists')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

/** All (playlist_id, track_id) memberships for the org's playlists. */
export function usePlaylistMemberships(organizationId: string | null) {
  return useQuery({
    queryKey: playlistTracksKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<{ playlist_id: string; track_id: string }[]> => {
      if (!organizationId) return []
      const { data: playlists, error: pErr } = await supabase
        .from('music_playlists')
        .select('id')
        .eq('organization_id', organizationId)
      if (pErr) throw pErr
      const ids = (playlists ?? []).map((p) => p.id)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('music_playlist_tracks')
        .select('playlist_id, track_id')
        .in('playlist_id', ids)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreatePlaylist(organizationId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      if (!organizationId) throw new Error('No organization')
      const { data, error } = await supabase
        .from('music_playlists')
        .insert({ organization_id: organizationId, name: name.trim() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playlistsKey(organizationId) }),
  })
}

export function useDeletePlaylist(organizationId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (playlistId: string) => {
      const { error } = await supabase.from('music_playlists').delete().eq('id', playlistId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: playlistsKey(organizationId) })
      void qc.invalidateQueries({ queryKey: playlistTracksKey(organizationId) })
    },
  })
}

export function useAddTracksToPlaylist(organizationId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ playlistId, trackIds }: { playlistId: string; trackIds: string[] }) => {
      if (trackIds.length === 0) return
      const rows = trackIds.map((track_id) => ({ playlist_id: playlistId, track_id }))
      // Ignore rows already present (composite PK) so re-adding is a no-op.
      const { error } = await supabase
        .from('music_playlist_tracks')
        .upsert(rows, { onConflict: 'playlist_id,track_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playlistTracksKey(organizationId) }),
  })
}

export function useRemoveTrackFromPlaylist(organizationId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ playlistId, trackId }: { playlistId: string; trackId: string }) => {
      const { error } = await supabase
        .from('music_playlist_tracks')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('track_id', trackId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playlistTracksKey(organizationId) }),
  })
}
