import { canResetEventData } from '@/lib/event-lifecycle'
import { deleteStorageObjects, publicUrlStoragePath } from '@/lib/storage'
import { syncTeamSlots } from '@/lib/sync-team-slots'
import { supabase } from '@/lib/supabase'

export const RESET_EVENT_DATA_ERROR =
  'Reset is only allowed for draft, ready, or demo events (not yet activated).'

/** Collect and delete all Storage files that belong to an event. */
async function deleteEventStorageFiles(eventId: string): Promise<void> {
  const [subsResult, teamsResult] = await Promise.all([
    supabase.from('submissions').select('media_url').eq('event_id', eventId).not('media_url', 'is', null),
    supabase.from('teams').select('photo_url').eq('event_id', eventId).not('photo_url', 'is', null),
  ])

  const paths: string[] = []
  for (const s of subsResult.data ?? []) {
    if (s.media_url) {
      const p = publicUrlStoragePath(s.media_url, 'game-assets')
      if (p) paths.push(p)
    }
  }
  for (const t of teamsResult.data ?? []) {
    if (t.photo_url) {
      const p = publicUrlStoragePath(t.photo_url, 'game-assets')
      if (p) paths.push(p)
    }
  }

  if (paths.length > 0) {
    // Non-fatal: log but don't throw so the DB reset still proceeds
    try {
      await deleteStorageObjects('game-assets', paths)
    } catch (err) {
      console.warn('[reset] storage cleanup partial failure', err)
    }
  }
}

/** Clear gameplay data, delete Storage files, and restore empty team slots. */
export async function resetEventData(eventId: string): Promise<void> {
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('status, team_count')
    .eq('id', eventId)
    .single()

  if (fetchErr) throw fetchErr
  if (!canResetEventData(event.status)) {
    throw new Error(RESET_EVENT_DATA_ERROR)
  }

  // Delete Storage files before wiping DB rows so we have the URLs
  await deleteEventStorageFiles(eventId)

  const { error: rpcErr } = await supabase.rpc('reset_event_data', {
    p_event_id: eventId,
  })
  if (rpcErr) throw rpcErr

  await syncTeamSlots(eventId, event.team_count)
}

/** Wipe all live data for an archived event (keeps the event row for payment history). */
export async function wipeEventData(eventId: string): Promise<void> {
  // Delete Storage files before wiping DB rows so we have the URLs
  await deleteEventStorageFiles(eventId)

  const { error } = await supabase.rpc('wipe_event_data', { p_event_id: eventId })
  if (error) throw error
}
