/**
 * Structural check on every quiz data file. Catches the mistakes that are
 * invisible in a live event until a team is staring at them: a duplicated
 * option, a correct index pointing at nothing, two identical questions, or a
 * round that is not 20 questions long.
 *
 *   node scripts/check-quizzes.mjs
 */
import { readdirSync } from 'node:fs'
import { shuffleOptions } from './lib/quiz-shuffle.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = resolve(root, 'scripts/data/quizzes')
const ROUNDS = ['easy', 'medium', 'hard']
const PER_ROUND = 20

let failures = 0
const fail = (file, msg) => {
  console.error(`  FAIL ${file}: ${msg}`)
  failures++
}

const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()
for (const file of files) {
  const quiz = (await import(resolve(dir, file))).default
  const seen = new Map()
  let total = 0

  if (!quiz.name) fail(file, 'missing quiz name')

  for (const round of ROUNDS) {
    const questions = quiz[round]
    if (!Array.isArray(questions)) {
      fail(file, `round "${round}" missing`)
      continue
    }
    if (questions.length !== PER_ROUND) {
      fail(file, `round "${round}" has ${questions.length} questions, expected ${PER_ROUND}`)
    }
    questions.forEach(([text, options, correct], i) => {
      const where = `${round}[${i + 1}]`
      total++
      if (typeof text !== 'string' || text.trim().length < 8) {
        fail(file, `${where} question text looks wrong: ${JSON.stringify(text)}`)
      }
      if (!text.trim().endsWith('?')) {
        fail(file, `${where} question does not end in a question mark`)
      }
      if (!Array.isArray(options) || options.length !== 4) {
        fail(file, `${where} needs exactly 4 options, got ${options?.length}`)
        return
      }
      if (options.some((o) => typeof o !== 'string' || !o.trim())) {
        fail(file, `${where} has an empty option`)
      }
      const unique = new Set(options.map((o) => o.trim().toLowerCase()))
      if (unique.size !== options.length) {
        fail(file, `${where} has duplicate options: ${JSON.stringify(options)}`)
      }
      if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
        fail(file, `${where} correct index ${correct} is out of range`)
      }
      const key = text.trim().toLowerCase()
      if (seen.has(key)) fail(file, `${where} duplicates ${seen.get(key)}`)
      else seen.set(key, where)
    })
  }

  // Questions are written with the answer wherever it reads best, so the source
  // clusters. What matters is the spread AFTER the seeder's shuffle, which is
  // what a team actually sees.
  const positions = [0, 0, 0, 0]
  for (const round of ROUNDS) {
    for (const [text, options, correct] of quiz[round] ?? []) {
      if (!Array.isArray(options) || options.length !== 4) continue
      const shuffled = shuffleOptions(text, options, correct)
      if (shuffled.correctIndex < 0) {
        fail(file, `shuffle lost the correct answer for: ${text}`)
        continue
      }
      positions[shuffled.correctIndex]++
    }
  }
  const worst = Math.max(...positions)
  const spread = positions.join('/')
  if (worst > total * 0.4) {
    fail(file, `answers still cluster after shuffling (${spread})`)
  }

  console.log(`  ${quiz.name}: ${total} questions, answer spread ${spread}`)
}

console.log(files.length ? '' : '  no quiz files found')
if (failures) {
  console.error(`\n${failures} problem(s) found`)
  process.exit(1)
}
console.log(`${files.length} quiz file(s) passed`)
