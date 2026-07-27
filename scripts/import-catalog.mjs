import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdmin } from './lib/env.mjs'

/**
 * One-off client catalog import: games (photo/video/text/quiz) + inventory items,
 * from a pre-built JSON file (see shape below). Used for onboarding a client's
 * existing spreadsheet-based game library into RallyHub.
 *
 * Usage: node scripts/import-catalog.mjs path/to/catalog.json
 *
 * JSON shape:
 * {
 *   "orgSubdomain": "afterglow",
 *   "games": [
 *     { "name": "...", "type": "photo|video|text|quiz", "description": "...",
 *       "groupName": "...", "points_static": 100, "config": {} }
 *   ],
 *   "inventoryItems": [
 *     { "name": "...", "description": "...", "points_cost": 10 }
 *   ]
 * }
 */

const jsonPath = process.argv[2]
if (!jsonPath) {
  console.error('Usage: node scripts/import-catalog.mjs path/to/catalog.json')
  process.exit(1)
}

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey)

const data = JSON.parse(readFileSync(jsonPath, 'utf8'))
const games = data.games ?? []
const inventoryItems = data.inventoryItems ?? []

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('subdomain', data.orgSubdomain)
    .single()
  if (orgErr || !org) {
    console.error(`Organization with subdomain "${data.orgSubdomain}" not found:`, orgErr?.message)
    process.exit(1)
  }
  console.log(`Importing into ${org.name} (${org.id})`)

  // Groups: reuse existing, create missing.
  const { data: existingGroups, error: groupsErr } = await supabase
    .from('game_groups')
    .select('id, name')
    .eq('organization_id', org.id)
  if (groupsErr) throw groupsErr

  const groupIdByName = new Map(existingGroups.map((g) => [g.name.trim().toLowerCase(), g.id]))
  const wantedGroupNames = [...new Set(games.map((g) => g.groupName).filter(Boolean))]
  const missingGroupNames = wantedGroupNames.filter((n) => !groupIdByName.has(n.trim().toLowerCase()))

  if (missingGroupNames.length > 0) {
    const { data: created, error } = await supabase
      .from('game_groups')
      .insert(missingGroupNames.map((name) => ({ organization_id: org.id, name })))
      .select('id, name')
    if (error) throw error
    for (const g of created) groupIdByName.set(g.name.trim().toLowerCase(), g.id)
    console.log(`Created ${created.length} game group(s): ${missingGroupNames.join(', ')}`)
  }

  // Games, chunked, preserving order so we can link groups by position.
  let insertedCount = 0
  const links = []
  for (const batch of chunk(games, 200)) {
    const { data: inserted, error } = await supabase
      .from('games')
      .insert(
        batch.map((g) => ({
          organization_id: org.id,
          name: g.name,
          type: g.type,
          description: g.description ?? null,
          points_type: 'static',
          points_static: g.points_static,
          points_min: null,
          points_max: null,
          status: 'draft',
          is_platform_template: false,
          config: g.config ?? {},
        })),
      )
      .select('id, name')
    if (error) throw error
    inserted.forEach((row, i) => {
      const groupName = batch[i]?.groupName
      const groupId = groupName ? groupIdByName.get(groupName.trim().toLowerCase()) : null
      if (groupId) links.push({ group_id: groupId, game_id: row.id })
    })
    insertedCount += inserted.length
  }
  console.log(`Inserted ${insertedCount} game(s)`)

  for (const batch of chunk(links, 500)) {
    const { error } = await supabase.from('game_group_items').insert(batch)
    if (error) throw error
  }
  console.log(`Linked ${links.length} game(s) to groups`)

  // Inventory items.
  let itemCount = 0
  for (const batch of chunk(inventoryItems, 200)) {
    const { error } = await supabase.from('inventory_items').insert(
      batch.map((it) => ({
        organization_id: org.id,
        name: it.name,
        description: it.description ?? null,
        points_cost: it.points_cost,
        is_active: true,
      })),
    )
    if (error) throw error
    itemCount += batch.length
  }
  console.log(`Inserted ${itemCount} inventory item(s)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
