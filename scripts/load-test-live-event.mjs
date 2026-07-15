/**
 * Live-event load test: simulates N participant phones against a real event.
 *
 * Each simulated phone follows the exact production participant path:
 *   1. bootstrap_live_event_access RPC (anon)  -> join token
 *   2. bundle load: events + event_state + teams + get_live_event_games + submissions
 *   3. subscribe to the shared Realtime broadcast channel
 *   4. concurrent submission INSERTs (anon + x-join-token, real RLS path)
 *      + broadcast fan-out, measuring propagation lag on every other phone
 *
 * Usage:
 *   node scripts/load-test-live-event.mjs [--event <uuid>] [--phones 15] [--waves 5] [--interval 2000]
 *
 * Requires .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY (team seeding + cleanup only — phones run as anon).
 * Everything the script creates (teams, submissions) is deleted afterwards.
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
const anonKey = env.VITE_SUPABASE_ANON_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const PHONES = Number(arg('phones', 15))
const WAVES = Number(arg('waves', 5))
const INTERVAL = Number(arg('interval', 2000))
const EVENT_ARG = arg('event', null)

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const pct = (arr, p) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const stats = (label, arr) =>
  console.log(
    `  ${label.padEnd(28)} n=${String(arr.length).padStart(4)}  p50=${pct(arr, 50).toFixed(0)}ms  p95=${pct(arr, 95).toFixed(0)}ms  max=${Math.max(0, ...arr).toFixed(0)}ms`,
  )

async function main() {
  // ── pick event + game ──────────────────────────────────────────────────────
  let eventId = EVENT_ARG
  if (!eventId) {
    const { data } = await admin
      .from('events')
      .select('id, name, status')
      .in('status', ['demo', 'ready', 'active'])
      .limit(1)
    if (!data?.length) throw new Error('No demo/ready/active event found. Pass --event <uuid>.')
    eventId = data[0].id
    console.log(`Event: ${data[0].name} (${data[0].status}) ${eventId}`)
  }

  const { data: eventGames } = await admin
    .from('event_games')
    .select('game_id')
    .eq('event_id', eventId)
    .limit(1)
  if (!eventGames?.length) throw new Error('Event has no games attached.')
  const gameId = eventGames[0].game_id

  // ── seed throwaway teams (service role; slot numbers above real ones) ─────
  const { data: existing } = await admin.from('teams').select('slot_number').eq('event_id', eventId)
  const base = Math.max(100, ...(existing ?? []).map((t) => t.slot_number + 1))
  const { data: teams, error: teamErr } = await admin
    .from('teams')
    .insert(
      Array.from({ length: PHONES }, (_, i) => ({
        event_id: eventId,
        name: `LOADTEST Team ${i + 1}`,
        slot_number: base + i,
        status: 'active',
      })),
    )
    .select('id')
  if (teamErr) throw teamErr
  const teamIds = teams.map((t) => t.id)
  const createdSubmissionIds = []

  try {
    // ── phase 1: bootstrap (all phones at once, like a QR-code rush) ────────
    console.log(`\nSpawning ${PHONES} phones...`)
    const bootstrapMs = []
    const bare = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    let joinToken
    await Promise.all(
      Array.from({ length: PHONES }, async () => {
        const t0 = performance.now()
        const { data, error } = await bare.rpc('bootstrap_live_event_access', { p_event_id: eventId })
        if (error || !data) throw error ?? new Error('no join token (event not demo/ready/active?)')
        bootstrapMs.push(performance.now() - t0)
        joinToken = data
      }),
    )

    // ── phase 2: bundle load + realtime subscribe per phone ────────────────
    const bundleMs = []
    const subscribeMs = []
    const sendTimes = new Map() // submission id -> perf timestamp
    const broadcastLagMs = []
    let broadcastsReceived = 0

    const phones = await Promise.all(
      Array.from({ length: PHONES }, async (_, i) => {
        const client = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { 'x-join-token': joinToken } },
        })

        let t0 = performance.now()
        const [ev, state, tms, games, subs] = await Promise.all([
          client.from('events').select('*').eq('id', eventId).single(),
          client.from('event_state').select('*').eq('event_id', eventId).maybeSingle(),
          client.from('teams').select('*').eq('event_id', eventId).order('slot_number'),
          client.rpc('get_live_event_games', { p_event_id: eventId }),
          client.from('submissions').select('*').eq('event_id', eventId),
        ])
        for (const r of [ev, state, tms, games, subs]) if (r.error) throw r.error
        bundleMs.push(performance.now() - t0)

        t0 = performance.now()
        const channel = client.channel(`live:${eventId}:${joinToken.slice(0, 16)}`, {
          config: { broadcast: { self: false } },
        })
        channel.on('broadcast', { event: 'live_bundle' }, ({ payload }) => {
          if (payload?.kind !== 'submission') return
          broadcastsReceived++
          const sent = sendTimes.get(payload.row?.id)
          if (sent !== undefined) broadcastLagMs.push(performance.now() - sent)
        })
        await new Promise((res, rej) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') res()
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') rej(new Error(`phone ${i}: ${status}`))
          })
        })
        subscribeMs.push(performance.now() - t0)
        return { client, channel, teamId: teamIds[i] }
      }),
    )
    console.log('All phones connected.')
    stats('bootstrap RPC', bootstrapMs)
    stats('bundle load (5 queries)', bundleMs)
    stats('realtime subscribe', subscribeMs)

    // ── phase 3: submission waves ───────────────────────────────────────────
    const insertMs = []
    let insertErrors = 0
    for (let w = 1; w <= WAVES; w++) {
      await Promise.all(
        phones.map(async (phone, i) => {
          const t0 = performance.now()
          const { data, error } = await phone.client
            .from('submissions')
            .insert({
              id: crypto.randomUUID(),
              event_id: eventId,
              team_id: phone.teamId,
              game_id: gameId,
              media_url: `LOADTEST wave ${w} phone ${i}`,
              media_type: 'text',
              status: 'pending',
            })
            .select()
            .single()
          if (error) {
            insertErrors++
            return
          }
          insertMs.push(performance.now() - t0)
          createdSubmissionIds.push(data.id)
          sendTimes.set(data.id, performance.now())
          // same fire-and-forget broadcast shape as publishSubmissionChange()
          void phone.channel.send({
            type: 'broadcast',
            event: 'live_bundle',
            payload: { kind: 'submission', op: 'INSERT', row: data },
          })
        }),
      )
      console.log(`  wave ${w}/${WAVES} done`)
      if (w < WAVES) await new Promise((r) => setTimeout(r, INTERVAL))
    }
    await new Promise((r) => setTimeout(r, 3000)) // let broadcasts drain

    console.log(`\nResults (${PHONES} phones, ${WAVES} waves):`)
    stats('submission INSERT', insertMs)
    stats('broadcast propagation', broadcastLagMs)
    const expected = createdSubmissionIds.length * (PHONES - 1)
    console.log(`  broadcasts received: ${broadcastsReceived}/${expected} (${expected ? ((100 * broadcastsReceived) / expected).toFixed(1) : 0}%)`)
    console.log(`  insert errors: ${insertErrors}`)

    for (const p of phones) await p.client.removeChannel(p.channel)
  } finally {
    // ── cleanup: only what we created ───────────────────────────────────────
    if (createdSubmissionIds.length) {
      await admin.from('submissions').delete().in('id', createdSubmissionIds)
    }
    await admin.from('teams').delete().in('id', teamIds)
    console.log(`\nCleaned up ${createdSubmissionIds.length} submissions + ${teamIds.length} teams.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
