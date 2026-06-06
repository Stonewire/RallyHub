import type { GameConfig } from '@/types/game-config'
import { deleteStorageObjects, publicUrlStoragePath } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

export async function bingoGamesReferencingCatalogTrack(
  organizationId: string,
  catalogTrackId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, config')
    .eq('organization_id', organizationId)
    .eq('type', 'music_bingo')

  if (error) throw error

  const matches: { id: string; name: string }[] = []
  for (const game of data ?? []) {
    const config = game.config as GameConfig | null
    const tracks = config?.tracks ?? []
    if (tracks.some((track) => track.id === catalogTrackId)) {
      matches.push({ id: game.id, name: game.name })
    }
  }
  return matches
}

export async function deleteMusicCatalogAudioFiles(row: {
  audio_url: string
  clip_url: string | null
}): Promise<void> {
  const paths: string[] = []
  const audioPath = row.audio_url
    ? publicUrlStoragePath(row.audio_url, 'game-assets')
    : null
  const clipPath = row.clip_url ? publicUrlStoragePath(row.clip_url, 'game-assets') : null
  if (audioPath) paths.push(audioPath)
  if (clipPath && clipPath !== audioPath) paths.push(clipPath)
  await deleteStorageObjects('game-assets', paths)
}
