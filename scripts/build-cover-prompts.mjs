/**
 * Regenerates docs/GAME-COVER-PROMPTS.md from whatever is actually in the
 * platform library, so the filename lists can never drift from the games.
 *
 *   node scripts/build-cover-prompts.mjs
 *
 * One prompt per group, each covering every cover in that group, because the
 * image generator can produce a batch from a single paste.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const HOUSE_STYLE =
  'Flat vector editorial illustration, 3:2 landscape, 1200x800. Bold geometric ' +
  'shapes, thick confident outlines, generous negative space, and one clear ' +
  'focal idea that still reads at thumbnail size on a phone. Absolutely no text, ' +
  'letters, numbers or lettering of any kind anywhere in any image. No logos, no ' +
  'brand marks, no recognisable real people, no faces with detailed features.'

/** Creative direction per group. Keyed by the group name in the library. */
const DIRECTION = {
  'Group 1 — Alliance Arcade': {
    folder: 'covers/alliance-arcade',
    palette: 'electric blue, coral and warm yellow on a deep navy ground',
    subject:
      'Every image shows two distinct groups of abstract human figures cooperating: ' +
      'reaching toward each other, interlocking, mirroring, or building something ' +
      'together. Figures are simple overlapping geometric forms, never detailed ' +
      'characters. The feeling is two teams becoming one.',
  },
  'Group 2 — Squad vs Squad': {
    folder: 'covers/squad-vs-squad',
    palette: 'purple, lime and black with sharp white highlights',
    subject:
      'Every image shows a single team performing, competing or executing with ' +
      'precision, often against a diagonal split or an implied opponent off-frame. ' +
      'Abstract geometric figures, poised and energetic. The feeling is focused ' +
      'competition.',
  },
  'Group 3 — Splash & Sunshine': {
    folder: 'covers/splash-and-sunshine',
    palette: 'aqua, sunset orange and sand yellow, high summer light',
    subject:
      'Every image is outdoors in summer: flat horizon bands of sky, sea and sand, ' +
      'a low sun, geometric water splashes, and abstract figures in motion. Warm, ' +
      'bright and open. The feeling is a hot day outside.',
  },
  'Group 4 — Office Quest Lab': {
    folder: 'covers/office-quest-lab',
    palette: 'navy, mint and paper white with a single coral accent',
    subject:
      'Every image is an isometric or flat desk-world scene built from ordinary ' +
      'workplace objects rendered as clean geometry: monitors, mugs, sticky notes, ' +
      'chairs, cups, paperclips, stationery. Playful and tidy, like a laboratory ' +
      'made of office supplies. Screens are always blank.',
  },
  'Group 5 — Motion Mission': {
    folder: 'covers/motion-mission',
    palette: 'red, cobalt and neon green on a dark ground',
    subject:
      'Every image shows movement: abstract geometric figures mid-action with ' +
      'motion lines, repeated poses suggesting a sequence, or a wave passing ' +
      'through a group. Dynamic and kinetic. The feeling is a body in motion.',
  },
  Puzzles: {
    folder: 'covers/puzzles',
    palette:
      'deep indigo ground with amber, green and slate accents for Word Rally; ' +
      'teal and warm orange for Match Rally; navy and mint for Grid Rally',
    subject:
      'Word Rally covers show a horizontal row of five empty rounded square tiles, ' +
      'some amber, some green, most just outlined, floating over a simple scene ' +
      'that suggests the theme. Match Rally covers show two vertical columns of ' +
      'blank rounded cards joined by connecting lines, over simplified objects for ' +
      'the theme. Grid Rally covers show an empty 6x6 grid of rounded squares, some ' +
      'filled solid as blocked cells, tilted slightly, over a simple themed scene. ' +
      'The tiles, cards and grid squares are always EMPTY. Never draw letters in them.',
  },
  Quizzes: {
    folder: 'covers/quizzes',
    palette: 'one distinct palette per quiz, listed with each filename below',
    subject:
      'Each quiz cover is a single bold symbolic composition for its theme, built ' +
      'from original shapes invented for this image. Never copy or evoke existing ' +
      'franchise artwork, costumes, characters, posters or logos.',
  },
}

/** Per-quiz direction, since each quiz cover is its own idea. */
const QUIZ_NOTES = {
  'The Ultimate Harry Potter Quiz':
    'a wand crossed with a bubbling potion bottle and three floating candles, ' +
    'deep plum and antique gold, candlelit. Invented shapes only, nothing from ' +
    'the films',
  'Marvel: Heroes, Villains & Infinity':
    'six glowing gem shapes arranged in an arc above an abstract caped silhouette, ' +
    'cosmic purple, red and gold. The silhouette is a generic figure, not any ' +
    'existing character, and the gems are plain faceted shapes',
  'Bonjour, France!':
    'an invented iron lattice tower, a baguette and a wedge of cheese as flat ' +
    'geometry, tricolour blue, white and red with a warm cream ground',
  'Passport Please!':
    'a stylised globe as a simple circle with abstract non-real continents, ringed ' +
    'by dashed flight paths and small luggage tags, teal and warm orange',
  'Screen Time':
    'a widening projector beam across the frame with empty seat silhouettes in the ' +
    'foreground, deep red, charcoal and warm gold',
  'The 90s & 2000s Time Machine':
    'a cassette tape, a chunky mobile phone and a burnt CD arranged as flat ' +
    'geometry on a memphis-pattern ground, hot pink, cyan and yellow',
}

async function main() {
  const env = { ...loadEnv(), ...process.env }
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('subdomain', LIBRARY_SUBDOMAIN)
    .single()
  const { data: groups } = await admin
    .from('game_groups')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('name')

  let md = `# Game cover image prompts

Generated by \`scripts/build-cover-prompts.mjs\` from the live platform library.
Re-run it after adding games so the filename lists stay accurate.

**How to use this:** paste ONE numbered section below into your image generator.
Each section is a single prompt that produces every cover for that group in one
batch. Save the results into the folder named in the section, using the exact
filenames listed, then upload each one to its game in the platform library.

**Size:** 1200x800 (3:2 landscape). Covers render with \`object-contain\`, so the
whole image is always visible. Keep anything important out of the outer 5%.

**Applies to every prompt:** ${HOUSE_STYLE}

---
`

  let n = 0
  for (const group of groups) {
    const direction = DIRECTION[group.name]
    if (!direction) continue
    const { data: items } = await admin
      .from('game_group_items')
      .select('game_id')
      .eq('group_id', group.id)
    const { data: games } = await admin
      .from('games')
      .select('name')
      .in('id', items.map((i) => i.game_id))
      .order('name')

    n++
    md += `
## Prompt ${n} — ${group.name} (${games.length} images)

**Save to:** \`${direction.folder}/\`

> ${HOUSE_STYLE}
>
> Palette for this whole set: ${direction.palette}.
>
> ${direction.subject}
>
> Produce ${games.length} separate images, one for each title below. Each image
> should clearly suggest its own title while staying in the shared style and
> palette above, so the set reads as one family. Remember: no text, letters or
> numbers in any image.
>
`
    games.forEach((game, i) => {
      const extra = group.name === 'Quizzes' ? ` — ${QUIZ_NOTES[game.name] ?? ''}` : ''
      md += `> ${String(i + 1).padStart(2, '0')}. **${game.name}**${extra}\n`
    })

    md += `
**Filenames**

\`\`\`
${games.map((g) => `${direction.folder}/${slug(g.name)}.png`).join('\n')}
\`\`\`
`
  }

  md += `
---

## Source manually

These cannot be generated and need a licensed image if you want the real thing.

- Any quest challenge naming a specific real painting, album cover or film
  poster (Famous Painting, Conference-Room Album, Two-Team Movie Poster). The
  generated cover shows the *act of recreating*, which is fine. Swap in a
  licensed image only if you want the actual artwork shown.
- Real landmark photography for the travel quizzes, if you ever want photos
  rather than the illustrated covers above.
- Client-branded event covers, which always come from the client.
`

  writeFileSync(resolve(root, 'docs/GAME-COVER-PROMPTS.md'), md)
  console.log(`wrote docs/GAME-COVER-PROMPTS.md with ${n} prompts`)
}

await main()
