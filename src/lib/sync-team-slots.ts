import { supabase } from '@/lib/supabase'

export const SLOT_COLORS = [
  '#E53935',
  '#1E88E5',
  '#43A047',
  '#FB8C00',
  '#8E24AA',
  '#00ACC1',
  '#FDD835',
  '#6D4C41',
  '#D81B60',
  '#3949AB',
  '#00897B',
  '#F4511E',
  '#5E35B1',
  '#039BE5',
  '#7CB342',
  '#FF7043',
  '#8D6E63',
  '#546E7A',
  '#C0CA33',
  '#26A69A',
]

function pickColor(used: Set<string>, index: number): string {
  for (let i = 0; i < SLOT_COLORS.length; i++) {
    const c = SLOT_COLORS[(index + i) % SLOT_COLORS.length]
    if (!used.has(c)) return c
  }
  return SLOT_COLORS[index % SLOT_COLORS.length]
}

function isUnclaimed(team: {
  name: string | null
  photo_url: string | null
}): boolean {
  return !team.name?.trim() && !team.photo_url
}

/** Sync team slots and ensure event_state exists after event create/update. */
export async function syncTeamSlots(eventId: string, teamCount: number) {
  const count = Math.max(1, Math.min(20, teamCount))

  const { data: existing, error: fetchErr } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', eventId)
    .order('slot_number', { ascending: true })

  if (fetchErr) throw fetchErr

  const teams = existing ?? []
  const usedColors = new Set(
    teams.map((t) => t.color).filter((c): c is string => Boolean(c)),
  )
  const bySlot = new Map(teams.map((t) => [t.slot_number, t]))

  if (teams.length > count) {
    const toRemove = teams
      .filter((t) => t.slot_number > count && isUnclaimed(t))
      .map((t) => t.id)
    if (toRemove.length > 0) {
      const { error } = await supabase.from('teams').delete().in('id', toRemove)
      if (error) throw error
    }
  }

  for (let slot = 1; slot <= count; slot++) {
    if (!bySlot.has(slot)) {
      const color = pickColor(usedColors, slot - 1)
      usedColors.add(color)
      const { error } = await supabase.from('teams').insert({
        event_id: eventId,
        slot_number: slot,
        color,
        name: null,
        photo_url: null,
        score: 0,
        status: 'idle',
      })
      // 23505 = a concurrent insert (DB trigger / realtime) already created this
      // slot. Harmless on duplicate create — only re-throw genuine errors.
      if (error && error.code !== '23505') throw error
    }
  }

  const { data: state } = await supabase
    .from('event_state')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle()

  if (!state) {
    const { error } = await supabase.from('event_state').insert({
      event_id: eventId,
    })
    // event_state may be auto-created by a trigger right after the event insert;
    // tolerate that race so a freshly duplicated event doesn't report failure.
    if (error && error.code !== '23505') throw error
  }
}
