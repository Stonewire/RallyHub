import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdmin } from './lib/env.mjs'

const ORG_ID = '4754ee86-aafa-4e2a-9940-d914aa61ff89' // Afterglow Events
const dataPath = process.argv[2]
if (!dataPath) {
  console.error('Usage: node scripts/apply-afterglow-rework.mjs path/to/afterglow-rework.json')
  process.exit(1)
}

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey)
const data = JSON.parse(readFileSync(dataPath, 'utf8'))

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  // 1. Create the Puzzles group.
  let { data: puzzleGroup, error: pgErr } = await supabase
    .from('game_groups')
    .select('id, name')
    .eq('organization_id', ORG_ID)
    .ilike('name', 'Puzzles (TBD)')
    .maybeSingle()
  if (pgErr) throw pgErr
  if (!puzzleGroup) {
    const { data: created, error } = await supabase
      .from('game_groups')
      .insert({ organization_id: ORG_ID, name: 'Puzzles (TBD)' })
      .select('id, name')
      .single()
    if (error) throw error
    puzzleGroup = created
  }
  console.log(`Puzzles group: ${puzzleGroup.id}`)

  // 2. Puzzle-parked games: update name (minor), move to Puzzles group.
  const puzzleIds = Object.keys(data.puzzle_updates)
  for (const batch of chunk(puzzleIds, 50)) {
    for (const id of batch) {
      const upd = data.puzzle_updates[id]
      const { error } = await supabase.from('games').update({ name: upd.name }).eq('id', id)
      if (error) throw error
    }
  }
  // Repoint game_group_items for these ids to the Puzzles group.
  for (const batch of chunk(puzzleIds, 200)) {
    const { error } = await supabase
      .from('game_group_items')
      .update({ group_id: puzzleGroup.id })
      .in('game_id', batch)
    if (error) throw error
  }
  console.log(`Moved ${puzzleIds.length} games into Puzzles (TBD)`)

  // 3. Delete puzzle duplicate extras.
  for (const batch of chunk(data.puzzle_delete, 200)) {
    const { error } = await supabase.from('games').delete().in('id', batch)
    if (error) throw error
  }
  console.log(`Deleted ${data.puzzle_delete.length} puzzle duplicate(s)`)

  // 4. Non-puzzle games: update name/description/config/points.
  const updateIds = Object.keys(data.updates)
  let done = 0
  for (const id of updateIds) {
    const upd = data.updates[id]
    const { error } = await supabase
      .from('games')
      .update({
        name: upd.name,
        description: upd.description,
        config: upd.config,
        points_static: upd.points_static,
      })
      .eq('id', id)
    if (error) throw error
    done++
  }
  console.log(`Updated ${done} games with new name/description/answer/points`)

  // 5. Delete non-puzzle duplicate extras.
  for (const batch of chunk(data.deletes, 200)) {
    const { error } = await supabase.from('games').delete().in('id', batch)
    if (error) throw error
  }
  console.log(`Deleted ${data.deletes.length} duplicate(s)`)

  // 6. Report image plan summary.
  const selfCount = Object.values(data.image_plan).filter((v) => v.kind === 'self').length
  const clientCount = Object.values(data.image_plan).filter((v) => v.kind === 'client').length
  console.log(`Image plan: ${selfCount} to self-generate, ${clientCount} need client-sourced images`)

  // Append a client-needed note to descriptions for client-sourced images.
  for (const [id, plan] of Object.entries(data.image_plan)) {
    if (plan.kind !== 'client') continue
    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('description')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    const note = ' (image needed: attach before publishing)'
    const newDesc = (game.description ?? '') + note
    const { error } = await supabase.from('games').update({ description: newDesc }).eq('id', id)
    if (error) throw error
  }
  console.log('Appended image-needed notes to client-sourced games')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
