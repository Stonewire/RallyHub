import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdmin } from './lib/env.mjs'

const ORG_ID = '4754ee86-aafa-4e2a-9940-d914aa61ff89' // Afterglow Events

// name fixes: title-case cleanup + one leftover Spanish word translated
const NAME_FIXES = {
  dentures: 'Dentures',
  Cordel: 'String',
}

const QUANTITY_PHRASES = {
  'One per team': 'Provide one per team.',
  'Two per team': 'Provide two per team.',
  'One for every two teams': 'Provide one for every two teams to share.',
  'One for three teams': 'Provide one for every three teams to share.',
}

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey)

async function main() {
  const { data: items, error } = await supabase
    .from('inventory_items')
    .select('id, name, description, public_code')
    .eq('organization_id', ORG_ID)
  if (error) throw error

  let fixed = 0
  let badCode = 0
  for (const item of items) {
    const match = /^Domino Effect\.\s*([^.]+)\./.exec(item.description ?? '')
    const quantity = match?.[1]?.trim()
    const phrase = quantity ? QUANTITY_PHRASES[quantity] : null
    if (!phrase) {
      console.warn(`Unrecognized quantity for "${item.name}": ${item.description}`)
      continue
    }
    const newName = NAME_FIXES[item.name] ?? item.name
    const newDescription = `Prop for the Domino Effect challenge. ${phrase}`
    const { error: updErr } = await supabase
      .from('inventory_items')
      .update({ name: newName, description: newDescription })
      .eq('id', item.id)
    if (updErr) throw updErr
    fixed++
    if (!item.public_code) badCode++
  }
  console.log(`Fixed ${fixed}/${items.length} items. Missing public_code: ${badCode}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
