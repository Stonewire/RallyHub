import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function q(text, answers, ci) {
  const ans = answers.map((t) => ({ id: randomUUID(), text: t }))
  return { id: randomUUID(), text, answers: ans, correctAnswerId: ans[ci].id, roundId: null }
}

const questions = [
  q('What is the capital of France?', ['London', 'Paris', 'Berlin', 'Madrid'], 1),
  q('Which planet is the largest in our solar system?', ['Earth', 'Mars', 'Jupiter', 'Venus'], 2),
  q('What is 15 + 27?', ['40', '41', '42', '43'], 2),
  q('Who wrote the Harry Potter series?', ['Tolkien', 'Rowling', 'Austen', 'King'], 1),
  q('What is the chemical symbol for gold?', ['Go', 'Gd', 'Au', 'Ag'], 2),
  q('How many continents are there?', ['5', '6', '7', '8'], 2),
  q('Which ocean is the largest?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3),
  q('In what year did World War II end?', ['1943', '1944', '1945', '1946'], 2),
  q('What gas do plants absorb from the atmosphere?', [
    'Oxygen',
    'Nitrogen',
    'Carbon dioxide',
    'Hydrogen',
  ], 2),
  q('How many sides does a hexagon have?', ['5', '6', '7', '8'], 1),
]

const quiz = { timer_seconds: 25, questions, rounds_enabled: false, rounds: [] }

const songs = [
  ['Bohemian Rhapsody', 'Queen'],
  ['Billie Jean', 'Michael Jackson'],
  ['Hey Jude', 'The Beatles'],
  ['Smells Like Teen Spirit', 'Nirvana'],
  ['Wonderwall', 'Oasis'],
  ['Rolling in the Deep', 'Adele'],
  ['Uptown Funk', 'Bruno Mars'],
  ['Shape of You', 'Ed Sheeran'],
  ['Blinding Lights', 'The Weeknd'],
  ['Hotel California', 'Eagles'],
  ['Sweet Child O Mine', "Guns N' Roses"],
  ['Livin on a Prayer', 'Bon Jovi'],
  ["Don't Stop Believin'", 'Journey'],
  ['Africa', 'Toto'],
  ['Take on Me', 'a-ha'],
  ['Mr. Brightside', 'The Killers'],
  ['Dancing Queen', 'ABBA'],
  ['September', 'Earth, Wind & Fire'],
  ['Thriller', 'Michael Jackson'],
  ['Imagine', 'John Lennon'],
  ['Yellow', 'Coldplay'],
  ['Viva la Vida', 'Coldplay'],
  ['Piano Man', 'Billy Joel'],
  ['Rocket Man', 'Elton John'],
  ['Born to Run', 'Bruce Springsteen'],
]

const tracks = songs.map(([title, artist]) => ({
  id: randomUUID(),
  title,
  artist,
  audioUrl: '',
}))

const bingo = {
  tracks,
  bonus_challenges: [],
  primary_color: '#3E3D3E',
  secondary_color: '#6f6f6f',
  accent_color: '#FFCB03',
}

const dir = resolve(root, 'supabase/seed-data')
mkdirSync(dir, { recursive: true })
writeFileSync(resolve(dir, 'default-quiz-config.json'), JSON.stringify(quiz))
writeFileSync(resolve(dir, 'default-bingo-config.json'), JSON.stringify(bingo))
console.log('Wrote supabase/seed-data/*.json')
