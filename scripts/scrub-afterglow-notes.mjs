import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdmin } from './lib/env.mjs'

const ORG_ID = '4754ee86-aafa-4e2a-9940-d914aa61ff89' // Afterglow Events

const IMAGE_NOTE = ' (image needed: attach before publishing)'
const ANSWER_NOTE = ' (import: set correct answer before publishing)'

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey)

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, description, solution_description')
    .eq('organization_id', ORG_ID)
  if (error) throw error

  let fixed = 0
  for (const g of games) {
    const desc = g.description ?? ''
    let clean = desc
    let note = null

    if (desc.endsWith(IMAGE_NOTE)) {
      clean = desc.slice(0, -IMAGE_NOTE.length)
      note = 'Facilitator note: attach a real reference image before publishing this game.'
    } else if (desc.endsWith(ANSWER_NOTE)) {
      clean = desc.slice(0, -ANSWER_NOTE.length)
      note = 'Facilitator note: the correct answer is a placeholder, set the real one before publishing.'
    } else {
      continue
    }

    const { error: updErr } = await supabase
      .from('games')
      .update({
        description: clean,
        solution_description: g.solution_description?.trim() ? g.solution_description : note,
      })
      .eq('id', g.id)
    if (updErr) throw updErr
    fixed++
  }
  console.log(`Scrubbed ${fixed} game(s) of leaked internal notes`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
