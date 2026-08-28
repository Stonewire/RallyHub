import { canResetEventData } from '@/lib/event-lifecycle'
import { publishLiveBundleReload } from '@/lib/live-broadcast'
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

/**
 * Permanently delete an event: media files first (the URLs are gone once the
 * rows are), then wipe_event_data removes every child row and the event row
 * itself. An invoiced event keeps a bare wiped stub so billing history stays
 * intact; the RPC allows client admins for their own org and super admins for
 * any client's event.
 */
export async function deleteEventPermanently(eventId: string): Promise<void> {
  await deleteEventStorageFiles(eventId)
  const { error } = await supabase.rpc('wipe_event_data', { p_event_id: eventId })
  if (error) throw error
}

/**
 * True when the event holds any demo-run leftovers worth warning about:
 * a claimed team (name set), a submission, a bingo run, or an event_state row
 * that has moved off the fresh defaults reset_event_data restores (stage or
 * quiz advanced, bingo started, announcement set). The last two catch
 * facilitator-only demos that never claimed a team or submitted anything.
 * Used by the activation flow to decide whether the event must be cleared
 * before going live (P4.2).
 */
export async function eventHasDemoData(eventId: string): Promise<boolean> {
  const [teamsRes, subsRes, bingoRes, stateRes] = await Promise.all([
    supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('name', 'is', null)
      .neq('name', ''),
    supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('bingo_runs')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('event_state')
      .select('current_stage_index, current_question_index, quiz_state, bingo_state, announcement')
      .eq('event_id', eventId)
      .maybeSingle(),
  ])
  if (teamsRes.error) throw teamsRes.error
  if (subsRes.error) throw subsRes.error
  if (bingoRes.error) throw bingoRes.error
  if (stateRes.error) throw stateRes.error
  const state = stateRes.data
  const stateDirty = Boolean(
    state &&
      (state.current_stage_index > 0 ||
        state.current_question_index > 0 ||
        state.quiz_state !== 'idle' ||
        state.bingo_state !== 'waiting' ||
        state.announcement !== null),
  )
  return (
    (teamsRes.count ?? 0) > 0 ||
    (subsRes.count ?? 0) > 0 ||
    (bingoRes.count ?? 0) > 0 ||
    stateDirty
  )
}

/**
 * Ask the DB entitlement gate (assert_event_activation_allowed) whether this
 * event may activate, without changing anything. The gate normally only fires
 * inside the status update trigger, AFTER the demo-data clear has already run;
 * calling this first means a refused activation never destroys demo data.
 * Throws the same tagged errors the trigger raises (ORG_SUSPENDED,
 * SUBSCRIPTION_REQUIRED, UNPAID_INVOICE, EVENT_LIMIT_REACHED, ...).
 */
export async function precheckEventActivation(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('precheck_event_activation', {
    p_event_id: eventId,
  })
  if (error) throw error
}

export const RESTART_RECURRING_ERROR =
  'Only a recurring event that has finished a run (and is not live) can be restarted.'

/**
 * P6.4: re-arm a recurring event for its next run. Mirrors resetEventData's
 * shape (Storage cleanup first, while the rows still hold the URLs; then the
 * DB wipe; then fresh empty team slots), but goes through the dedicated
 * restart_recurring_event RPC, which snapshots the finished run into
 * event_occurrences, supersedes its invoice, and clears activated_at so the
 * next activation bills as a new run.
 *
 * The unpaid-invoice check runs BEFORE the Storage cleanup: the RPC refuses to
 * restart over an unpaid invoice, and by then the run's media would already be
 * gone. Throws with the same UNPAID_INVOICE tag the RPC raises so callers map
 * both paths identically.
 */
export async function restartRecurringEvent(eventId: string): Promise<void> {
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('status, team_count, recurring, activated_at')
    .eq('id', eventId)
    .single()

  if (fetchErr) throw fetchErr
  if (!event.recurring || event.status === 'active' || !event.activated_at) {
    throw new Error(RESTART_RECURRING_ERROR)
  }

  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('event_id', eventId)
    .eq('superseded', false)
    .maybeSingle()
  if (invoiceErr) throw invoiceErr
  if (invoice?.status === 'unpaid') {
    throw new Error("UNPAID_INVOICE: Settle this event's invoice before starting the next run.")
  }

  // Delete Storage files before wiping DB rows so we have the URLs.
  await deleteEventStorageFiles(eventId)

  const { error: rpcErr } = await supabase.rpc('restart_recurring_event', {
    p_event_id: eventId,
  })
  if (rpcErr) throw rpcErr

  await syncTeamSlots(eventId, event.team_count)

  // Any device still parked on the old run's join page drops the wiped teams
  // and refetches the fresh slot list (anon clients don't get postgres_changes).
  await publishLiveBundleReload(eventId)
}

/** Clear gameplay data, delete Storage files, and restore empty team slots. */
export async function resetEventData(eventId: string): Promise<void> {
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('status, team_count, open_joining')
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

  // The reset_event_data RPC deletes EVERY teams row and restores a fresh
  // event_state. For a normal event, syncTeamSlots then recreates the empty
  // slot list. For an open-joining event (P6.3) deleting all teams IS the
  // correct fresh run: teams only exist because participants created them,
  // and there are no slots to restore, so syncTeamSlots must not run (it
  // would pre-create empty slots that the join page never offers).
  // event_state needs no follow-up either: the RPC upserts it itself.
  if (!event.open_joining) {
    await syncTeamSlots(eventId, event.team_count)
  }

  // #8: push a live reload so any connected player/display drops the old teams
  // and refetches the fresh slot list (anon clients don't get postgres_changes).
  await publishLiveBundleReload(eventId)
}
