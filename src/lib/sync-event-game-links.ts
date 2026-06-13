import { formatSupabaseError, logSupabaseFailure } from '@/lib/supabase-errors'
import { supabase } from '@/lib/supabase'

/**
 * Sync event_games to match desired game ids: insert new links, remove dropped
 * ones, leave unchanged links untouched (avoids 409 on unique (event_id, game_id)).
 */
export async function syncEventGameLinks(
  eventId: string,
  organizationId: string,
  gameIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(gameIds)]

  let desiredIds: string[] = []
  if (uniqueIds.length > 0) {
    const { data: validGames, error: validError } = await supabase
      .from('games')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', uniqueIds)

    if (validError) {
      logSupabaseFailure('games.select for event_games sync', validError)
      throw new Error(formatSupabaseError(validError))
    }
    desiredIds = (validGames ?? []).map((g) => g.id)
  }

  const desiredSet = new Set(desiredIds)

  const { data: existingRows, error: fetchError } = await supabase
    .from('event_games')
    .select('game_id')
    .eq('event_id', eventId)

  if (fetchError) {
    logSupabaseFailure('event_games.select for sync', fetchError)
    throw new Error(formatSupabaseError(fetchError))
  }

  const existingSet = new Set((existingRows ?? []).map((r) => r.game_id))
  const toAdd = desiredIds.filter((id) => !existingSet.has(id))
  const toRemove = [...existingSet].filter((id) => !desiredSet.has(id))

  if (toRemove.length > 0) {
    const { error: delError } = await supabase
      .from('event_games')
      .delete()
      .eq('event_id', eventId)
      .in('game_id', toRemove)

    if (delError) {
      logSupabaseFailure('event_games.delete for sync', delError)
      throw new Error(formatSupabaseError(delError))
    }
  }

  if (toAdd.length > 0) {
    const { error: upsertError } = await supabase.from('event_games').upsert(
      toAdd.map((game_id) => ({
        event_id: eventId,
        game_id,
      })),
      { onConflict: 'event_id,game_id', ignoreDuplicates: true },
    )

    if (upsertError) {
      logSupabaseFailure('event_games.upsert for sync', upsertError)
      throw new Error(formatSupabaseError(upsertError))
    }
  }
}
