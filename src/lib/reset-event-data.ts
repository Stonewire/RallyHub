import { canResetEventData } from '@/lib/event-lifecycle'
import { syncTeamSlots } from '@/lib/sync-team-slots'
import { supabase } from '@/lib/supabase'

export const RESET_EVENT_DATA_ERROR =
  'Reset is only allowed for draft, ready, or demo events (not yet activated).'

/** Clear gameplay data and restore empty team slots. Event config is kept. */
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

  const { error: rpcErr } = await supabase.rpc('reset_event_data', {
    p_event_id: eventId,
  })
  if (rpcErr) throw rpcErr

  await syncTeamSlots(eventId, event.team_count)
}
