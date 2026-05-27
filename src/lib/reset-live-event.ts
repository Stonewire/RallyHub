import { TEAM_COLORS } from '@/lib/event-form-utils'
import type { EventTeam } from '@/types/game-config'
import { SLOT_COLORS, syncTeamSlots } from '@/lib/sync-team-slots'
import { supabase } from '@/lib/supabase'

export function unclaimedTeamSlots(count: number): EventTeam[] {
  const n = Math.max(1, Math.min(20, count))
  return Array.from({ length: n }, (_, i) => ({
    id: crypto.randomUUID(),
    name: '',
    color: TEAM_COLORS[i % TEAM_COLORS.length],
  }))
}

/**
 * Clears all live progress for an event while keeping stages, linked games, and structure.
 * - Deletes submissions and chat
 * - Clears team claims (names/photos), scores, status
 * - Resets facilitator/display state to stage 1
 */
export async function resetLiveEvent(eventId: string, teamCount: number) {
  const { error: subErr } = await supabase
    .from('submissions')
    .delete()
    .eq('event_id', eventId)
  if (subErr) throw subErr

  const { error: chatErr } = await supabase
    .from('chat_messages')
    .delete()
    .eq('event_id', eventId)
  if (chatErr) throw chatErr

  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, slot_number')
    .eq('event_id', eventId)
  if (teamsErr) throw teamsErr

  for (const team of teams ?? []) {
    const color = SLOT_COLORS[(team.slot_number - 1) % SLOT_COLORS.length]
    const { error } = await supabase
      .from('teams')
      .update({
        name: null,
        photo_url: null,
        score: 0,
        status: 'idle',
        color,
      })
      .eq('id', team.id)
    if (error) throw error
  }

  const { error: eventErr } = await supabase
    .from('events')
    .update({
      teams_config: unclaimedTeamSlots(teamCount),
    })
    .eq('id', eventId)
  if (eventErr) throw eventErr

  const { data: state, error: stateFetchErr } = await supabase
    .from('event_state')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (stateFetchErr) throw stateFetchErr

  if (state) {
    const { error: stateErr } = await supabase
      .from('event_state')
      .update({
        current_stage_index: 0,
        current_question_index: 0,
        timer_seconds: 7200,
        timer_running: false,
        quiz_timer_seconds: null,
        quiz_timer_running: false,
        show_scores: true,
        show_timer_on_display: true,
        quiz_state: 'idle',
        bingo_state: 'waiting',
        announcement: null,
        announcement_target: null,
        winner_reveal_stage: 0,
        break_timer_seconds: 300,
        break_timer_running: false,
        submissions_open: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.id)
    if (stateErr) throw stateErr
  } else {
    const { error: insertErr } = await supabase.from('event_state').insert({
      event_id: eventId,
      break_timer_seconds: 300,
      quiz_state: 'idle',
    })
    if (insertErr) throw insertErr
  }

  await syncTeamSlots(eventId, teamCount)
}
