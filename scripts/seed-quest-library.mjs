/**
 * Seeds the quest catalogue from docs/GAME-CONTENT-PLAN.md into the RallyHub
 * Game Library org as platform templates, and builds the five game groups.
 *
 * The markdown stays the source of truth: edit the plan, re-run, rows update.
 *
 * Usage:
 *   node scripts/seed-quest-library.mjs --dry     # parse and report, write nothing
 *   node scripts/seed-quest-library.mjs           # create/update games + groups
 *   node scripts/seed-quest-library.mjs --remove  # delete everything it created
 *
 * Text games use points type to decide how they score: a range means the
 * facilitator judges the answer, static means it is checked against a correct
 * answer. The judged challenges in the plan are seeded as ranges.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_SUBDOMAIN = 'rallyhub-library'

function loadEnv() {
  const path = resolve(root, '.env')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * Text challenges with no single correct answer. These seed as judged games,
 * which in RallyHub means range points: the facilitator reads the answer and
 * awards a score instead of it being matched automatically.
 *
 * Four of them are written in the plan with fixed points, which a judged text
 * game cannot express. They get a range floored at a third of the planned value
 * so a weak-but-real answer still earns something, with the plan's number as the
 * maximum. Adjust in the editor if that split is wrong.
 */
const JUDGED_TEXT = new Set([
  'Five-Word Story Chain',
  'Memory Tray',
  'Exact Estimate',
  'Brand Slogan Remix',
  'Step-Count Estimate',
  'Shade Strategy',
  'Policy in Plain English',
  'Neatest Drawer Plan',
  'Email Subject Rescue',
])

function parsePlan() {
  const md = readFileSync(resolve(root, 'docs/GAME-CONTENT-PLAN.md'), 'utf8')
  const rows = []
  let group = null
  for (const line of md.split('\n')) {
    const heading = line.trim().match(/^## (Group \d+ — .+)$/)
    if (heading) group = heading[1]
    if (!group || !line.startsWith('| ') || line.includes('---')) continue
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
    if (cells.length !== 5 || cells[0] === 'Game') continue
    const [name, submission, challenge, points, labels] = cells
    rows.push({ group, name, submission, challenge, points, labels })
  }
  return rows
}

/** "Video, 20s" / "Video, 60s max" -> seconds. Defaults to the plan's 20s norm. */
function videoSeconds(submission) {
  const m = submission.match(/(\d+)\s*s/i)
  return m ? Number(m[1]) : 20
}

/** "50–250" -> judged range. "100" -> fixed. En dash and hyphen both appear. */
function parsePoints(points) {
  const m = points.match(/^(\d+)\s*[–-]\s*(\d+)$/)
  if (m) {
    return {
      points_type: 'range',
      points_static: null,
      points_min: Number(m[1]),
      points_max: Number(m[2]),
    }
  }
  return {
    points_type: 'static',
    points_static: Number(points),
    points_min: null,
    points_max: null,
  }
}

function toGame(row) {
  const kind = row.submission.split(',')[0].trim().toLowerCase()
  const judged = kind === 'text' && JUDGED_TEXT.has(row.name)
  let points = parsePoints(row.points)
  if (judged && points.points_type === 'static') {
    const max = points.points_static
    points = {
      points_type: 'range',
      points_static: null,
      points_min: Math.round(max / 3),
      points_max: max,
    }
  }

  const base = {
    name: row.name,
    description: row.challenge,
    ...points,
    is_platform_template: true,
    status: 'active',
  }

  if (kind === 'photo') return { ...base, type: 'photo', config: {} }
  if (kind === 'video') {
    return {
      ...base,
      type: 'video',
      config: { max_video_duration_seconds: videoSeconds(row.submission) },
    }
  }
  if (kind === 'text') {
    // Judged games need no answers. Auto-scored ones are seeded with an empty
    // list so the organiser fills in the accepted answers in the editor, rather
    // than this script inventing them.
    return {
      ...base,
      type: 'text',
      config: { text_answer_mode: 'type_text', text_correct_answers: [] },
    }
  }
  return null
}

async function main() {
  const mode = process.argv[2] ?? ''
  const rows = parsePlan()
  const planned = rows.map((r) => ({ row: r, game: toGame(r) }))
  const usable = planned.filter((p) => p.game)
  const judged = usable.filter((p) => JUDGED_TEXT.has(p.row.name))

  console.log(`parsed ${rows.length} placements from the plan`)
  console.log(`  seeding     : ${usable.length}`)
  console.log(`  judged text : ${judged.length} (facilitator scores these)`)
  for (const j of judged) {
    console.log(
      `                - ${j.row.name}: plan ${j.row.points} -> range ${j.game.points_min}-${j.game.points_max}`,
    )
  }

  if (mode === '--dry') return

  const env = { ...loadEnv(), ...process.env }
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('subdomain', LIBRARY_SUBDOMAIN)
    .single()
  if (orgError) throw orgError
  console.log(`\nlibrary org: ${org.name}`)

  const planNames = rows.map((r) => r.name)
  const groupNames = [...new Set(rows.map((r) => r.group))]

  if (mode === '--remove') {
    const { data: gone } = await admin
      .from('games')
      .delete()
      .eq('organization_id', org.id)
      .in('name', planNames)
      .select('id')
    await admin.from('game_groups').delete().eq('organization_id', org.id).in('name', groupNames)
    console.log(`removed ${gone?.length ?? 0} games and their groups`)
    return
  }

  // Games are keyed by name inside the library org, so re-running updates in
  // place instead of stacking duplicates.
  const { data: existing } = await admin
    .from('games')
    .select('id, name')
    .eq('organization_id', org.id)
    .in('name', planNames)
  const byName = new Map((existing ?? []).map((g) => [g.name, g.id]))

  let created = 0
  let updated = 0
  const gameIdByName = new Map(byName)
  for (const { game } of usable) {
    const id = byName.get(game.name)
    if (id) {
      const { error } = await admin.from('games').update(game).eq('id', id)
      if (error) throw error
      updated++
    } else {
      const { data, error } = await admin
        .from('games')
        .insert({ ...game, organization_id: org.id })
        .select('id')
        .single()
      if (error) throw error
      gameIdByName.set(game.name, data.id)
      created++
    }
  }
  console.log(`games: ${created} created, ${updated} updated`)

  for (const groupName of groupNames) {
    let { data: group } = await admin
      .from('game_groups')
      .select('id')
      .eq('organization_id', org.id)
      .eq('name', groupName)
      .maybeSingle()
    if (!group) {
      const { data, error } = await admin
        .from('game_groups')
        .insert({ organization_id: org.id, name: groupName })
        .select('id')
        .single()
      if (error) throw error
      group = data
    }
    const memberIds = rows
      .filter((r) => r.group === groupName)
      .map((r) => gameIdByName.get(r.name))
      .filter(Boolean)
    await admin.from('game_group_items').delete().eq('group_id', group.id)
    if (memberIds.length) {
      const { error } = await admin
        .from('game_group_items')
        .insert(memberIds.map((game_id) => ({ group_id: group.id, game_id })))
      if (error) throw error
    }
    console.log(`group "${groupName}": ${memberIds.length} games`)
  }
}

await main()
