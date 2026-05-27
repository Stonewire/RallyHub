/**
 * Seeds default games + "Full Test Event" for one org via RPC (migration 009).
 * Prefer: npm run seed:all-orgs  (all organizations)
 *
 * Requires migration 009 applied + .env service role key.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const path = resolve(root, '.env')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const env = { ...loadEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n' +
      'Add the service role key from Supabase → Project Settings → API (keep it secret).',
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  let orgId = env.SEED_ORGANIZATION_ID
  if (!orgId) {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
    if (error) throw error
    if (!orgs?.length) {
      throw new Error('No organization found. Create one in Supabase first.')
    }
    orgId = orgs[0].id
    console.log(`Using organization: ${orgs[0].name} (${orgId})`)
  }

  const { error: rpcErr } = await supabase.rpc('seed_organization_defaults', {
    p_org_id: orgId,
  })
  if (rpcErr) {
    console.error(rpcErr.message)
    console.error(
      '\nApply supabase/migrations/009_organization_defaults.sql in Supabase SQL Editor first.',
    )
    process.exit(1)
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('organization_id', orgId)
    .eq('name', 'Full Test Event')
    .maybeSingle()

  const base =
    env.SEED_APP_ORIGIN ||
    (env.VITE_PLATFORM_HOST ? `https://${env.VITE_PLATFORM_HOST}` : 'http://localhost:5173')

  console.log('\n✅ Defaults seeded\n')
  if (event) {
    console.log(`Event ID: ${event.id}`)
    console.log(`  Facilitator: ${base}/facilitator/${event.id}`)
    console.log(`  Display:     ${base}/display/${event.id}`)
    console.log(`  Join:        ${base}/join/${event.id}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
