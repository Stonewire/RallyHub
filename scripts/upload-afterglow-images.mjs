import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAdmin } from './lib/env.mjs'

const ORG_ID = '4754ee86-aafa-4e2a-9940-d914aa61ff89' // Afterglow Events
const PHOTOS_DIR =
  '/Users/rumenaleksandrov/Library/Mobile Documents/com~apple~CloudDocs/Cowork Plauground/RallyHub/rallyhub/generated Photos'

// filename -> game id (from the afterglow rework's self-generate image plan)
const MAP = {
  '01-art-glitch-renaissance-extra-finger.png': 'bca400d7-7d76-4766-9a4c-d3c215ed3e64',
  '02-art-glitch-harbour-mast-water.png': '30929aea-71fc-41f7-a650-8f75af2e2869',
  '03-art-glitch-floating-city-windows.png': '26b4dda7-b474-4e8d-ad50-c1182418b85b',
  '04-art-glitch-pop-art-necklace.png': 'd1cdc2d6-4877-4576-a477-07252676feea',
  '05-art-glitch-crowd-two-left-hands.png': '31c9fbcf-01f2-4010-bebd-a5087a5d486a',
  '06-art-movement-impressionism-riverside.png': 'a09ffbb7-ea32-441b-ba8a-b27fbe832fc0',
  '07-art-movement-cubist-portrait.png': '2e6267fe-e680-4c82-b505-665c40b045c2',
  '08-art-movement-pop-art-portrait.png': '272ae51e-fd01-4eb1-b916-73c49ffbc3d9',
  '09-art-movement-surrealist-clocks.png': '77155193-4d5f-4eab-af70-872cd0316966',
  '10-art-movement-art-nouveau-portrait.png': '2a6eef80-9996-4bc1-b680-1229ca09d4e9',
  '11-cooking-saffron-threads.png': '55a3086d-de76-4c3f-91ac-481cb717aa18',
  '12-cooking-star-anise.png': '0ce2bab8-a414-4272-a3c8-f859929586d3',
  '13-cooking-fennel-bulb.png': '75c34121-a260-44ef-8fc8-a8cdcb954cbd',
  '14-cooking-tamarind-paste.png': '1ceab9e6-4d20-496d-9385-8def0829800b',
  '15-cooking-nutritional-yeast.png': 'f06367fe-7d85-460f-8575-5daaa102a042',
  '16-geography-flag-japan.png': '3a218395-f72e-4dab-8bde-9c0b0f80a290',
  '17-geography-flag-switzerland.png': '55309eb3-c3c6-4bd4-a688-095c1599c7a8',
  '18-geography-flag-brazil.png': '155c711e-51a8-4f61-bbc9-4ee31c27b40d',
  '19-geography-flag-kenya.png': '27633961-a571-48e2-a8c8-65e541fcfa9d',
  '20-geography-flag-nepal.png': '1ff2fdd0-f538-4e02-a3bc-20f1e939482b',
  '21-geography-city-paris.png': '08aee197-0257-451d-8fa7-ecb83dc1d0f7',
  '22-geography-city-sydney.png': '97e93492-fd99-4c95-816b-ceb5ebf48cae',
  '23-geography-city-rio.png': '44fc3b7c-5bf7-42a2-95bd-92e5f79733e1',
  '24-geography-city-agra.png': '07883ea0-8342-41c9-aa43-c317f69e9e56',
  '25-geography-city-london.png': '4c2a8401-31b3-4717-9b5e-f1f04dadb778',
  '26-nature-leaf-maple.png': '1325fbb4-2d91-4d73-ba92-c12806af58c6',
  '27-nature-leaf-oak.png': '54429270-054d-4869-97fc-8ff3212a49c8',
  '28-nature-leaf-ginkgo.png': '0e762a15-6715-4c69-925d-7e1ee0c29861',
  '29-nature-leaf-fern.png': '62b1f9a1-e348-4271-9191-645cf928ae7f',
  '30-nature-leaf-holly.png': '0f4efb6f-fbc9-44f3-a3ee-77fce879b244',
  '31-nature-print-canine.png': '90ae3d8a-58a7-4e58-8093-4019cda75dcd',
  '32-nature-print-bear.png': '8326b97c-a640-4cc1-9f90-5c61974a0824',
  '33-nature-print-deer-hoof.png': '59b2966a-710d-4038-ba1d-83d50a9621fd',
  '34-nature-print-rabbit.png': '3db060b2-2b8a-4a32-a489-112a527b6e0b',
  '35-nature-print-webbed-bird.png': '82f31811-5d53-4169-8484-59634cd98c07',
}

const NOTE_RE =
  / \(image needed: was planned for AI generation but the connected image-gen key has no quota yet, attach manually or retry once billing is enabled\)/

const { url, serviceKey } = requireSupabaseAdmin()
const supabase = createClient(url, serviceKey)

async function main() {
  let ok = 0
  for (const [filename, gameId] of Object.entries(MAP)) {
    const bytes = readFileSync(`${PHOTOS_DIR}/${filename}`)
    const path = `${ORG_ID}/games/${gameId}/${randomUUID()}.png`
    const { error: upErr } = await supabase.storage
      .from('game-assets')
      .upload(path, bytes, { contentType: 'image/png', upsert: true })
    if (upErr) throw new Error(`${filename}: ${upErr.message}`)

    const { data: pub } = supabase.storage.from('game-assets').getPublicUrl(path)

    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('description')
      .eq('id', gameId)
      .single()
    if (fetchErr) throw fetchErr

    const cleanDescription = (game.description ?? '').replace(NOTE_RE, '')

    const { error: updErr } = await supabase
      .from('games')
      .update({ cover_url: pub.publicUrl, description: cleanDescription })
      .eq('id', gameId)
    if (updErr) throw updErr

    console.log(`${filename} -> ${gameId}`)
    ok++
  }
  console.log(`Uploaded and linked ${ok} images`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
