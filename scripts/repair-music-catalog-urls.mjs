/**
 * Repair broken music_catalog + music_bingo game track URLs after the upload fix.
 *
 * Problems fixed:
 *   - Double-encoded public URLs (%2520 → single encoding via getPublicUrl)
 *   - Double extensions in object keys (.mp3.mp3 → .mp3)
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to .env (Project Settings → API)
 *   2. Inspect storage first:
 *        node scripts/list-catalog-storage.mjs
 *   3. Dry run (no writes):
 *        node scripts/repair-music-catalog-urls.mjs
 *   4. Apply repairs (storage copy + DB updates):
 *        node scripts/repair-music-catalog-urls.mjs --apply
 *
 * Optional: pass org UUIDs as arguments (defaults to the two catalog orgs).
 */

import { createClient } from '@supabase/supabase-js'

import { requireSupabaseAdmin } from './lib/env.mjs'
import { hasApplyFlag, parseOrgIdsFromArgv } from './lib/parse-args.mjs'
import {
  BUCKET,
  cleanCatalogFilename,
  cleanObjectPath,
  extractUuidPrefix,
  hasDoubleExtension,
  hasEncodedPercent,
  pathFromPublicUrl,
  publicUrlFromStoragePath,
} from './lib/storage-url.mjs'

const DEFAULT_ORGS = [
  '8a0d915f-a5b0-4275-82d6-17ae4d93d55c',
  '1eb5c173-218e-426c-a9ff-0a41071a7742',
]

const APPLY = hasApplyFlag(process.argv)
const orgIds = parseOrgIdsFromArgv(process.argv, DEFAULT_ORGS)

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function listCatalogObjects(orgId) {
  const prefix = `${orgId}/catalog`
  const { data, error } = await supabase.storage.from(BUCKET).list(`${orgId}/catalog`, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw error
  return (data ?? []).map((item) => `${prefix}/${item.name}`)
}

/** Resolve a broken DB URL to the actual storage object path (if it exists). */
function resolveActualObjectPath(brokenUrl, objectSet) {
  const decoded = pathFromPublicUrl(brokenUrl)
  if (!decoded) return null

  if (objectSet.has(decoded)) return decoded

  // DB URL may point at double-encoded path; try progressively decoding filename.
  let candidate = decoded
  for (let i = 0; i < 3; i++) {
    const parts = candidate.split('/')
    const filename = parts[parts.length - 1]
    const nextFilename = decodeURIComponent(filename)
    if (nextFilename === filename) break
    parts[parts.length - 1] = nextFilename
    candidate = parts.join('/')
    if (objectSet.has(candidate)) return candidate
  }

  // Match by UUID prefix from upload (uuid-full-... / uuid-clip-...)
  const filename = decoded.split('/').pop() ?? ''
  const uuid = extractUuidPrefix(filename)
  if (uuid) {
    for (const objectPath of objectSet) {
      if (objectPath.includes(uuid)) return objectPath
    }
  }

  return null
}

async function ensureCleanObject(actualPath, objectSet, stats) {
  const cleanPath = cleanObjectPath(actualPath)
  if (cleanPath === actualPath) {
    return { path: actualPath, action: 'unchanged' }
  }

  if (objectSet.has(cleanPath)) {
    stats.reusedExistingClean++
    return { path: cleanPath, action: 'reused-existing-clean' }
  }

  stats.needsRename++
  if (!APPLY) {
    return { path: cleanPath, action: 'would-rename', from: actualPath }
  }

  const { error: copyError } = await supabase.storage.from(BUCKET).copy(actualPath, cleanPath)
  if (copyError) {
    // Fallback: download + upload
    const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(actualPath)
    if (dlError) throw dlError
    const { error: upError } = await supabase.storage.from(BUCKET).upload(cleanPath, blob, {
      upsert: true,
      contentType: blob.type || 'audio/mpeg',
    })
    if (upError) throw upError
  }

  const { error: rmError } = await supabase.storage.from(BUCKET).remove([actualPath])
  if (rmError) console.warn(`  ⚠ could not remove old object ${actualPath}: ${rmError.message}`)

  objectSet.add(cleanPath)
  objectSet.delete(actualPath)
  stats.renamed++
  return { path: cleanPath, action: 'renamed', from: actualPath }
}

async function headOk(publicUrl) {
  try {
    const res = await fetch(publicUrl, { method: 'HEAD' })
    return res.status
  } catch {
    return 'ERR'
  }
}

async function repairOrg(orgId) {
  console.log(`\n${'='.repeat(72)}`)
  console.log(`Organization: ${orgId}`)
  console.log(`${'='.repeat(72)}`)

  const objectPaths = await listCatalogObjects(orgId)
  const objectSet = new Set(objectPaths)

  console.log(`Storage objects: ${objectPaths.length}`)
  const doubleExt = objectPaths.filter((p) => hasDoubleExtension(p.split('/').pop()))
  const encoded = objectPaths.filter((p) => hasEncodedPercent(p.split('/').pop()))
  console.log(`  with double extension: ${doubleExt.length}`)
  console.log(`  with encoded chars (%20 etc): ${encoded.length}`)

  const stats = {
    catalogRows: 0,
    catalogUpdated: 0,
    gamesUpdated: 0,
    tracksUpdated: 0,
    needsRename: 0,
    renamed: 0,
    reusedExistingClean: 0,
    missingObject: 0,
  }

  const urlByCleanPath = new Map()

  async function publicUrlForCleanPath(cleanPath) {
    if (urlByCleanPath.has(cleanPath)) return urlByCleanPath.get(cleanPath)
    const publicUrl = publicUrlFromStoragePath(supabase, cleanPath)
    urlByCleanPath.set(cleanPath, publicUrl)
    return publicUrl
  }

  const { data: catalog, error: catErr } = await supabase
    .from('music_catalog')
    .select('id, title, artist, audio_url, clip_url')
    .eq('organization_id', orgId)
  if (catErr) throw catErr

  stats.catalogRows = catalog?.length ?? 0
  const catalogUrlMap = new Map()

  for (const row of catalog ?? []) {
    console.log(`\nCatalog: ${row.title} — ${row.artist}`)
    const resolved = { audioUrl: row.audio_url, clipUrl: row.clip_url }

    for (const [field, brokenUrl, key] of [
      ['audio_url', row.audio_url, 'audioUrl'],
      ['clip_url', row.clip_url, 'clipUrl'],
    ]) {
      if (!brokenUrl) continue

      const actualPath = resolveActualObjectPath(brokenUrl, objectSet)
      if (!actualPath) {
        console.log(`  ✗ ${field}: no storage object found for ${brokenUrl}`)
        stats.missingObject++
        continue
      }

      const { path: cleanPath, action, from } = await ensureCleanObject(actualPath, objectSet, stats)
      const newUrl = await publicUrlForCleanPath(cleanPath)
      const oldStatus = await headOk(brokenUrl)
      const newStatus = await headOk(newUrl)

      console.log(`  ${field}:`)
      console.log(`    actual object: ${actualPath}`)
      if (from) console.log(`    ${action}: ${from} → ${cleanPath}`)
      else console.log(`    object: ${action}`)
      console.log(`    DB URL HEAD ${oldStatus} → ${newStatus}`)
      console.log(`    new URL: ${newUrl}`)

      resolved[key] = newUrl
      if (brokenUrl !== newUrl) {
        catalogUrlMap.set(brokenUrl, newUrl)
        if (APPLY) {
          const patch = field === 'audio_url' ? { audio_url: newUrl } : { clip_url: newUrl }
          const { error } = await supabase.from('music_catalog').update(patch).eq('id', row.id)
          if (error) throw error
        }
        stats.catalogUpdated++
      }
    }

    catalogUrlMap.set(row.id, { audioUrl: resolved.audioUrl, clipUrl: resolved.clipUrl })
    if (row.audio_url) catalogUrlMap.set(row.audio_url, resolved.audioUrl)
    if (row.clip_url && resolved.clipUrl) catalogUrlMap.set(row.clip_url, resolved.clipUrl)
  }

  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id, name, config')
    .eq('organization_id', orgId)
    .eq('type', 'music_bingo')
  if (gamesErr) throw gamesErr

  for (const game of games ?? []) {
    const config = game.config && typeof game.config === 'object' ? { ...game.config } : {}
    const tracks = Array.isArray(config.tracks) ? config.tracks : []
    let gameChanged = false

    const nextTracks = tracks.map((track) => {
      if (!track || typeof track !== 'object') return track
      const t = { ...track }
      let trackChanged = false

      const byId = catalogUrlMap.get(t.id)
      if (byId && typeof byId === 'object') {
        if (byId.audioUrl && t.audioUrl !== byId.audioUrl) {
          t.audioUrl = byId.audioUrl
          trackChanged = true
        }
        if (byId.clipUrl && t.clipUrl !== byId.clipUrl) {
          t.clipUrl = byId.clipUrl
          trackChanged = true
        }
      }

      for (const key of ['audioUrl', 'clipUrl']) {
        const val = t[key]
        if (!val || typeof val !== 'string') continue
        const mapped = catalogUrlMap.get(val)
        if (typeof mapped === 'string' && mapped !== val) {
          t[key] = mapped
          trackChanged = true
        }
      }

      if (trackChanged) {
        gameChanged = true
        stats.tracksUpdated++
        console.log(`\nGame "${game.name}": updated track ${t.title ?? t.id}`)
      }
      return t
    })

    if (gameChanged) {
      stats.gamesUpdated++
      if (APPLY) {
        const { error } = await supabase
          .from('games')
          .update({ config: { ...config, tracks: nextTracks } })
          .eq('id', game.id)
        if (error) throw error
      }
    }
  }

  console.log(`\nSummary for ${orgId}:`)
  console.log(`  catalog rows: ${stats.catalogRows}`)
  console.log(`  catalog URL fields updated: ${stats.catalogUpdated}`)
  console.log(`  storage renames: ${stats.renamed} (planned: ${stats.needsRename})`)
  console.log(`  games updated: ${stats.gamesUpdated}`)
  console.log(`  tracks updated: ${stats.tracksUpdated}`)
  console.log(`  missing storage objects: ${stats.missingObject}`)
  console.log(`  mode: ${APPLY ? 'APPLIED' : 'DRY RUN (pass --apply to write)'}`)

  return stats
}

async function main() {
  const targets = orgIds
  console.log('Supabase URL:', url)
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY RUN')
  console.log('Organizations:', targets.join(', '))

  for (const orgId of targets) {
    await repairOrg(orgId)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
