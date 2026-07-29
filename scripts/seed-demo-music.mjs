import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

const SOURCE_ALBUM = 'https://freemusicarchive.org/music/holiznacc0/public-domain-lofi'
const LICENSE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/'
const STORAGE_PREFIX = 'demo-stock-music/holizna-cc0'

const tracks = [
  ['242429', 'One Night In France', 'hgY8pG5KicULRbUJjUVavqs1h53lNSHdLptPoCwS.mp3'],
  ['243304', 'Tranquil Mindscape', 'uxGaqYrlWHy1w4jA6fJki0NlNx6xkkFG5BMwI8JN.mp3'],
  ['238387', 'When Time Called Me Darling', '3Jox99wj2ur7YR7O1ug3fdP8NdOOpmHfVPFBRhq5.mp3'],
  ['243029', 'Canon Event', 'GLpVlXSJolOAOZSAMyf5ONpjKXfnnKbugQhR7GxD.mp3'],
  ['265871', 'Fractured', 'OKTeJladHnsapUepN68pWvlah2q7hLd7FlDHO15U.mp3'],
  ['245667', 'Still Life', 'X2xAunfMENT4KSm1XpnQC2qUUC4hcMVbDXBMw9GI.mp3'],
  ['265835', 'Calm Currents', '4rKapZUMNnNSPAOvpjlfSH6B5Ib8rgEWdvjnM7C6.mp3'],
  ['243511', 'Bubbles', 'zh5usndkyEfVvKOz8dvsrCd1Ga0jfz4xIcLUendD.mp3'],
  ['243030', 'Moon Unit', 'CbNZO1QUuJq1f50RHzZ5kykNj1hdqT04UaWOYSNf.mp3'],
  ['265877', 'Ghost Town', 'cR9QozfFah1QF4bmIg150gJsibgGDA3EX4m7Iova.mp3'],
  ['243512', 'Lucid', 'je7RethXWuduCoRV6Gq3w25yDXvxYnnOWt5OGlgv.mp3'],
  ['243305', 'Tokyo Sunset', 'Xnd9Hr5AVzB68IlWcImKtXPlwCePD2G2m8ZFSVj4.mp3'],
  ['265836', 'Peaceful Drift', 'SQvtLguk6S1VSthv0oXWycoB6ipUS0pt8jzAxxPq.mp3'],
  ['238388', 'Waiting Around', 'aVNvUkfJVw1NI9zHSC3I8d760YbwCt31a3Wi6Ydl.mp3'],
  ['245668', 'Theta Frequency', 'rSIDyunfJfiKNelwFuwbGKoLj5TO8eHFbdSa1zAb.mp3'],
  ['265878', 'Going Home', 'QdFLnSYEYDIThwBrSukcnPloklLuCyXGkkwYclJE.mp3'],
  ['238389', 'Shimmer', 'JX8dB2Y2tCty4tibXtqqd04m1IVgPegvzOeLOSzP.mp3'],
  ['265837', 'Reminders', 'r7Y9jjWggY2LIKonpPhkYrAQNJgm2daRHr5Kcc0I.mp3'],
  ['265838', 'Walking Away', 'WOtcP3GhbgTD8CuC6sEgpQOEXMyNeXYbTNmHjgN6.mp3'],
  ['265874', 'Nine To Death', 'NeWWEvcW3OV64fNtbkF0wOElg3SMeTW7Hv1Lutzq.mp3'],
  ['238390', 'Warm Fuzz', 'Qrd0JkjTC7XXJwtS6LvCHIJ9K1FLXewdrYOQHhc5.mp3'],
  ['238391', 'When I Was Human', 'ChrX4PnONgrlvh9m2tgYBpK7mwnbfpLJoo36OOFW.mp3'],
  ['265880', 'One Good Day', 'AQCAheI92mWqsSgQeYLB6CZ3J1hiaGZgtmA9VCes.mp3'],
  ['265839', 'Color Of A Soul', 'xRID4LBzd558K0DI9fjemJnZrxLueiba0GTOxUwL.mp3'],
  ['265840', 'Ode To Forgetting', 'PLQGg8DdEVSSXOKsRcI8y1yqEzOVoPA6yIdI7OLR.mp3'],
]

const slugify = (value) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `${command} exited with ${code}`))
    })
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ffmpegPath = process.env.FFMPEG_PATH

if (!supabaseUrl || !serviceRoleKey || !ffmpegPath) {
  throw new Error(
    'VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FFMPEG_PATH are required',
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const workDir = await mkdtemp(path.join(tmpdir(), 'rallyhub-demo-music-'))

try {
  for (const [sourceId, title, sourceFile] of tracks) {
    const sourceUrl = `https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/${sourceFile}`
    const objectPath = `${STORAGE_PREFIX}/${sourceId}-${slugify(title)}-30s.mp3`
    const inputPath = path.join(workDir, `${sourceId}-full.mp3`)
    const clipPath = path.join(workDir, `${sourceId}-30s.mp3`)

    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`Could not download ${title}: ${response.status}`)
    await writeFile(inputPath, Buffer.from(await response.arrayBuffer()))

    await run(ffmpegPath, [
      '-y',
      '-ss',
      '30',
      '-i',
      inputPath,
      '-t',
      '30',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '128k',
      clipPath,
    ])

    const clip = await readFile(clipPath)
    const { error } = await supabase.storage.from('game-assets').upload(objectPath, clip, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: true,
    })
    if (error) throw error

    process.stdout.write(`Uploaded ${title}\n`)
  }

  process.stdout.write(
    `\n25 CC0 clips uploaded. Source: ${SOURCE_ALBUM}\nLicense: ${LICENSE_URL}\n`,
  )
} finally {
  await rm(workDir, { recursive: true, force: true })
}
