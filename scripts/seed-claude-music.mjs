/**
 * Seeds the Claude Client tenant with a 25 track music library and one music
 * bingo game, for testing.
 *
 * The demo org's catalogue points `audio_url` at Free Music Archive and only
 * stores a pre-cut 30 second clip locally. That is no good for exercising clip
 * extraction, which needs a full track it can actually fetch: a cross-origin
 * MP3 without CORS headers cannot be read by ffmpeg.wasm in the browser. So
 * this downloads each full track, trims it to two minutes, and uploads it to
 * the project's own storage.
 *
 * Trimming is done by walking MP3 frame headers rather than shelling out to
 * ffmpeg, which is not installed here. Every MP3 frame carries its own header
 * and duration, so cutting on a frame boundary yields a valid file; cutting at
 * an arbitrary byte offset would not.
 *
 *   node scripts/seed-claude-music.mjs
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env. Safe to re-run: it clears the
 * tenant's catalogue and its seeded game first.
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const URL_BASE = env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !SERVICE_KEY) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const ORG_ID = '1b08f1e3-8075-4050-97ac-bf7d01cc9beb' // Claude Client
const BUCKET = 'game-assets'
const PREFIX = 'claude-qa-music'
const TARGET_SECONDS = 120

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// --- MP3 frame walking ------------------------------------------------------

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
const RATES_V1 = [44100, 48000, 32000, 0]
const RATES_V2 = [22050, 24000, 16000, 0]
const RATES_V25 = [11025, 12000, 8000, 0]

/** Skips an ID3v2 tag if present, so frame scanning starts on real audio. */
function audioStart(buf) {
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    return 10 + size
  }
  return 0
}

/**
 * Returns the byte offset at which the file reaches `seconds` of audio, or the
 * whole length if it is shorter, plus the total duration found.
 */
function cutOffset(buf, seconds) {
  let pos = audioStart(buf)
  let elapsed = 0
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) {
      pos += 1 // not a frame sync, walk forward
      continue
    }
    const versionBits = (buf[pos + 1] >> 3) & 0x03
    const layerBits = (buf[pos + 1] >> 1) & 0x03
    const bitrateIdx = (buf[pos + 2] >> 4) & 0x0f
    const rateIdx = (buf[pos + 2] >> 2) & 0x03
    const padding = (buf[pos + 2] >> 1) & 0x01
    if (layerBits !== 0x01 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) {
      pos += 1
      continue
    }

    const isV1 = versionBits === 3
    const rates = isV1 ? RATES_V1 : versionBits === 2 ? RATES_V2 : RATES_V25
    const bitrate = (isV1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIdx] * 1000
    const sampleRate = rates[rateIdx]
    if (!bitrate || !sampleRate) { pos += 1; continue }

    const samples = isV1 ? 1152 : 576
    const frameLength = Math.floor((samples / 8) * (bitrate / sampleRate)) + padding
    if (frameLength < 4) { pos += 1; continue }

    elapsed += samples / sampleRate
    pos += frameLength
    if (elapsed >= seconds) return { offset: pos, duration: elapsed }
  }
  return { offset: buf.length, duration: elapsed }
}

// --- run --------------------------------------------------------------------

const demoTracks = await rest(
  'music_catalog?select=artist,title,audio_url,genre&organization_id=eq.' +
    (await rest('organizations?select=id&is_demo=is.true'))[0].id +
    '&order=title',
)
console.log(`found ${demoTracks.length} source tracks on the demo org`)

console.log('clearing any previous seed')
await rest(`music_catalog?organization_id=eq.${ORG_ID}`, { method: 'DELETE' })
await rest(`games?organization_id=eq.${ORG_ID}&type=eq.music_bingo`, { method: 'DELETE' })

const rows = []
for (const [i, track] of demoTracks.entries()) {
  const label = `${i + 1}/${demoTracks.length} ${track.title}`
  try {
    const res = await fetch(track.audio_url)
    if (!res.ok) { console.warn(`${label}: download ${res.status}, skipped`); continue }
    const full = Buffer.from(await res.arrayBuffer())
    const { offset, duration } = cutOffset(full, TARGET_SECONDS)
    const trimmed = full.subarray(0, offset)

    const name = `${PREFIX}/${String(i + 1).padStart(2, '0')}-${track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp3`
    const up = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${name}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true' },
      body: trimmed,
    })
    if (!up.ok) { console.warn(`${label}: upload ${up.status} ${await up.text()}`); continue }

    rows.push({
      organization_id: ORG_ID,
      artist: track.artist,
      title: track.title,
      genre: track.genre,
      audio_url: `${URL_BASE}/storage/v1/object/public/${BUCKET}/${name}`,
      duration_seconds: Math.min(duration, TARGET_SECONDS),
      source_filename: `${track.title}.mp3`,
      license_confirmed_at: new Date().toISOString(),
    })
    console.log(`${label}: ${Math.round(duration)}s, ${(trimmed.length / 1024).toFixed(0)}kB`)
  } catch (err) {
    console.warn(`${label}: ${err.message}`)
  }
}

if (!rows.length) throw new Error('No tracks were uploaded')
const inserted = await rest('music_catalog?select=id,title,artist,audio_url,duration_seconds', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify(rows),
})
console.log(`\ninserted ${inserted.length} catalogue rows`)

const game = await rest('games?select=id,name', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify([{
    organization_id: ORG_ID,
    name: 'QA Music Bingo',
    type: 'music_bingo',
    description: 'Twenty five two minute tracks, for testing clip lengths and the bingo run.',
    status: 'active',
    points_type: 'static',
    points_static: 100,
    // clipUrl is deliberately left null: the point of this library is to
    // exercise clip extraction at different lengths, so the clips get cut in
    // the editor rather than arriving pre-made.
    config: {
      tracks: inserted.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        clipUrl: null,
        audioUrl: t.audio_url,
        clipStartSeconds: 0,
        clipDurationSeconds: 30,
      })),
    },
  }]),
})
console.log(`created game ${game[0].name} (${game[0].id})`)
