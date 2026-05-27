/**
 * Applies default games + Full Test Event to every organization via DB RPC.
 * Requires migration 009_organization_defaults.sql applied in Supabase.
 *
 *   npm run seed:all-orgs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const { data: orgs, error } = await supabase.from('organizations').select('id, name')
  if (error) throw error
  if (!orgs?.length) {
    console.log('No organizations found.')
    return
  }

  for (const org of orgs) {
    const { error: rpcErr } = await supabase.rpc('seed_organization_defaults', {
      p_org_id: org.id,
    })
    if (rpcErr) {
      console.error(`Failed for ${org.name}:`, rpcErr.message)
      if (rpcErr.message.includes('seed_organization_defaults')) {
        console.error(
          '\nRun migration 009 in Supabase SQL Editor first:\n' +
            '  supabase/migrations/009_organization_defaults.sql\n',
        )
        process.exit(1)
      }
    } else {
      console.log(`Seeded defaults: ${org.name}`)
    }
  }

  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
