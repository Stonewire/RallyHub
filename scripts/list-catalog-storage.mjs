/**
 * List game-assets objects under {orgId}/catalog for inspection.
 *
 * Usage:
 *   node scripts/list-catalog-storage.mjs
 *   node scripts/list-catalog-storage.mjs 8a0d915f-a5b0-4275-82d6-17ae4d93d55c
 */

import { createClient } from '@supabase/supabase-js'

import { requireSupabaseAdmin } from './lib/env.mjs'
import { parseOrgIdsFromArgv } from './lib/parse-args.mjs'
import {
  hasDoubleExtension,
  hasEncodedPercent,
  pathFromPublicUrl,
  publicUrlFromStoragePath,
} from './lib/storage-url.mjs'

const DEFAULT_ORGS = [
  '8a0d915f-a5b0-4275-82d6-17ae4d93d55c',
  '1eb5c173-218e-426c-a9ff-0a41071a7742',
]

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function listCatalogObjects(orgId) {
  const prefix = `${orgId}/catalog`
  const { data, error } = await supabase.storage.from('game-assets').list(`${orgId}/catalog`, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw error
  return (data ?? []).map((item) => `${prefix}/${item.name}`)
}

async function headPublicUrl(publicUrl) {
  try {
    const res = await fetch(publicUrl, { method: 'HEAD' })
    return res.status
  } catch {
    return 'ERR'
  }
}

async function inspectOrg(orgId) {
  console.log(`\n${'='.repeat(72)}`)
  console.log(`Organization: ${orgId}`)
  console.log(`${'='.repeat(72)}`)

  const objects = await listCatalogObjects(orgId)
  console.log(`Objects in storage (${objects.length}):`)
  if (objects.length === 0) {
    console.log('  (none)')
    return { orgId, objects: [] }
  }

  for (const objectPath of objects) {
    const filename = objectPath.split('/').pop()
    const flags = [
      hasDoubleExtension(filename) ? 'DOUBLE_EXT' : null,
      hasEncodedPercent(filename) ? 'ENCODED_CHARS' : null,
    ]
      .filter(Boolean)
      .join(', ')
    const publicUrl = publicUrlFromStoragePath(supabase, objectPath)
    const status = await headPublicUrl(publicUrl)
    console.log(`  • ${objectPath}`)
    console.log(`      flags: ${flags || 'ok'}`)
    console.log(`      public URL HEAD: ${status}`)
    console.log(`      url: ${publicUrl}`)
  }

  const { data: catalog, error: catErr } = await supabase
    .from('music_catalog')
    .select('id, title, artist, audio_url, clip_url')
    .eq('organization_id', orgId)
  if (catErr) throw catErr

  console.log(`\nDB music_catalog rows (${catalog?.length ?? 0}):`)
  for (const row of catalog ?? []) {
    const audioPath = pathFromPublicUrl(row.audio_url)
    const clipPath = row.clip_url ? pathFromPublicUrl(row.clip_url) : null
    const audioStatus = row.audio_url ? await headPublicUrl(row.audio_url) : '—'
    const clipStatus = row.clip_url ? await headPublicUrl(row.clip_url) : '—'
    console.log(`  • ${row.title} — ${row.artist} (${row.id})`)
    console.log(`      stored audio path: ${audioPath ?? '(unparseable)'}`)
    console.log(`      stored clip path:  ${clipPath ?? '(none)'}`)
    console.log(`      DB audio_url HEAD: ${audioStatus}`)
    console.log(`      DB clip_url HEAD:  ${clipStatus}`)
    if (row.audio_url?.includes('%2520')) console.log('      ⚠ audio_url has double-encoding (%2520)')
    if (row.clip_url?.includes('%2520')) console.log('      ⚠ clip_url has double-encoding (%2520)')
  }

  return { orgId, objects, catalog: catalog ?? [] }
}

async function main() {
  const orgIds = parseOrgIdsFromArgv(process.argv, DEFAULT_ORGS)
  console.log('Supabase URL:', url)
  console.log('Inspecting catalog storage for orgs:', orgIds.join(', '))

  for (const orgId of orgIds) {
    await inspectOrg(orgId)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
