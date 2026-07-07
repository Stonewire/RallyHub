import { toCsv } from '@/lib/csv'
import type { GameType, PointsType } from '@/types/database'
import type { GameConfig, QuizQuestion } from '@/types/game-config'

/**
 * Batch game import: CSV template + parser + row validation.
 * Backwards compatible with the original hand-made sheets
 * (Name, Type, Description, Point type, Points) — the extra columns are optional.
 * Photo / video / text / quiz only; music bingo needs audio uploads, so it is
 * excluded on purpose.
 */

export const GAME_IMPORT_HEADERS = [
  'Name',
  'Type',
  'Description',
  'Group',
  'Point type',
  'Points',
  'Time limit (seconds)',
  'Question',
  'Answers',
  'Correct answer',
] as const

const TEMPLATE_ROWS: string[][] = [
  [
    'Soak Your Opponent',
    'VIDEO',
    'Soak someone from an opposing team. Record the whole stunt.',
    'Outdoor games',
    'Static',
    '100',
    '30',
    '',
    '',
    '',
  ],
  [
    'Movie Scene',
    'PHOTO',
    'Recreate the iconic Titanic pose. Maximum points for similarity and creativity.',
    'Outdoor games',
    'Range',
    '50-300',
    '',
    '',
    '',
    '',
  ],
  [
    'Riddle Me This',
    'TEXT',
    'What has keys but opens no locks? Type your answer.',
    '',
    'Static',
    '50',
    '',
    '',
    'piano|a piano',
    '',
  ],
  [
    'Team Trivia',
    'TEXT',
    'Which colour is on our logo? Pick the right answer.',
    '',
    'Static',
    '50',
    '',
    '',
    'Red|Yellow|Green',
    'Yellow',
  ],
  [
    'Office Quiz',
    'QUIZ',
    'Quick-fire quiz. One row per question, same name on every row.',
    'Quizzes',
    'Static',
    '10',
    '20',
    'What is the capital of France?',
    'Madrid|Paris|Rome|Berlin',
    'Paris',
  ],
  [
    'Office Quiz',
    'QUIZ',
    '',
    '',
    '',
    '',
    '',
    'Which planet is known as the red planet?',
    'Venus|Mars|Jupiter',
    'Mars',
  ],
]

export function buildGameImportTemplate(): string {
  return toCsv([...GAME_IMPORT_HEADERS], TEMPLATE_ROWS)
}

/** RFC-4180 CSV parser: quoted fields, escaped quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Strip a UTF-8 BOM so the first header cell matches.
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop rows that are entirely empty.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export type PreparedGame = {
  name: string
  type: GameType
  description: string | null
  points_type: PointsType
  points_static: number | null
  points_min: number | null
  points_max: number | null
  config: GameConfig
  /** Group name to file the game under (created when missing). */
  groupName: string | null
}

export type GameImportPlan = {
  games: PreparedGame[]
  errors: string[]
  /** Distinct group names referenced by the rows. */
  groupNames: string[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  type: 'type',
  description: 'description',
  group: 'group',
  pointtype: 'pointType',
  pointstype: 'pointType',
  points: 'points',
  timelimitseconds: 'time',
  timelimit: 'time',
  time: 'time',
  question: 'question',
  answers: 'answers',
  correctanswer: 'correct',
}

const TYPES: Record<string, GameType> = {
  photo: 'photo',
  video: 'video',
  text: 'text',
  quiz: 'quiz',
}

function splitList(raw: string): string[] {
  return raw
    .split('|')
    .map((a) => a.trim())
    .filter(Boolean)
}

/** Turn parsed CSV rows into ready-to-insert games plus per-row error messages. */
export function buildGameImportPlan(rows: string[][]): GameImportPlan {
  const errors: string[] = []
  if (rows.length === 0) return { games: [], errors: ['The file is empty.'], groupNames: [] }

  const header = rows[0].map((h) => HEADER_ALIASES[norm(h)] ?? null)
  if (!header.includes('name') || !header.includes('type')) {
    return {
      games: [],
      errors: ['The first row must be the template header (at least Name and Type columns).'],
      groupNames: [],
    }
  }

  const col = (row: string[], key: string): string => {
    const idx = header.indexOf(key)
    return idx === -1 ? '' : (row[idx] ?? '').trim()
  }

  type QuizDraft = { game: PreparedGame; questions: QuizQuestion[]; firstRow: number }
  const games: PreparedGame[] = []
  const quizByName = new Map<string, QuizDraft>()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const rowNo = r + 1
    const name = col(row, 'name')
    const typeRaw = col(row, 'type')
    const type = TYPES[norm(typeRaw)]

    if (!name) {
      errors.push(`Row ${rowNo}: missing a game name.`)
      continue
    }
    if (!type) {
      errors.push(
        `Row ${rowNo} (${name}): unknown type "${typeRaw}" — use PHOTO, VIDEO, TEXT or QUIZ (music bingo cannot be imported, it needs audio files).`,
      )
      continue
    }

    // Points: "100" = static, "100-500" = range. The Point type column, when
    // filled, must agree with the format.
    const pointsRaw = col(row, 'points')
    const pointTypeRaw = norm(col(row, 'pointType'))
    const isQuizContinuation = type === 'quiz' && quizByName.has(name.toLowerCase())
    let points_type: PointsType = 'static'
    let points_static: number | null = null
    let points_min: number | null = null
    let points_max: number | null = null

    if (!isQuizContinuation || pointsRaw) {
      const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(pointsRaw)
      const staticMatch = /^\d+$/.test(pointsRaw)
      if (rangeMatch) {
        points_type = 'range'
        points_min = Number(rangeMatch[1])
        points_max = Number(rangeMatch[2])
        if (points_min >= points_max) {
          errors.push(`Row ${rowNo} (${name}): points range "${pointsRaw}" must be low-high.`)
          continue
        }
        if (pointTypeRaw === 'static') {
          errors.push(
            `Row ${rowNo} (${name}): Point type says Static but Points "${pointsRaw}" is a range.`,
          )
          continue
        }
      } else if (staticMatch) {
        points_static = Number(pointsRaw)
        if (pointTypeRaw === 'range') {
          errors.push(
            `Row ${rowNo} (${name}): Point type says Range but Points "${pointsRaw}" is a single number — use e.g. 100-500.`,
          )
          continue
        }
      } else if (pointsRaw) {
        errors.push(
          `Row ${rowNo} (${name}): could not read Points "${pointsRaw}" — use 100 or 100-500.`,
        )
        continue
      } else if (!isQuizContinuation) {
        errors.push(`Row ${rowNo} (${name}): missing Points.`)
        continue
      }
    }
    if (type === 'quiz' && points_type === 'range') {
      errors.push(`Row ${rowNo} (${name}): quiz games use static points per question.`)
      continue
    }

    const timeRaw = col(row, 'time')
    const timeSeconds = /^\d+$/.test(timeRaw) ? Number(timeRaw) : null
    if (timeRaw && timeSeconds == null) {
      errors.push(`Row ${rowNo} (${name}): Time limit "${timeRaw}" must be a number of seconds.`)
      continue
    }

    const answers = splitList(col(row, 'answers'))
    const correct = col(row, 'correct')
    const description = col(row, 'description') || null
    const groupName = col(row, 'group') || null

    if (type === 'quiz') {
      const question = col(row, 'question')
      if (!question) {
        errors.push(`Row ${rowNo} (${name}): quiz rows need a Question.`)
        continue
      }
      if (answers.length < 2 || answers.length > 6) {
        errors.push(`Row ${rowNo} (${name}): quiz questions need 2-6 answers separated by |.`)
        continue
      }
      if (!correct || !answers.includes(correct)) {
        errors.push(
          `Row ${rowNo} (${name}): Correct answer must exactly match one of the Answers.`,
        )
        continue
      }
      const quizAnswers = answers.map((text) => ({ id: crypto.randomUUID(), text }))
      const q: QuizQuestion = {
        id: crypto.randomUUID(),
        text: question,
        answers: quizAnswers,
        correctAnswerId: quizAnswers[answers.indexOf(correct)].id,
      }
      const existing = quizByName.get(name.toLowerCase())
      if (existing) {
        existing.questions.push(q)
        // First filled-in row wins for the game-level fields.
        if (description && !existing.game.description) existing.game.description = description
        if (groupName && !existing.game.groupName) existing.game.groupName = groupName
        if (timeSeconds && !existing.game.config.timer_seconds) {
          existing.game.config.timer_seconds = timeSeconds
        }
        continue
      }
      const game: PreparedGame = {
        name,
        type,
        description,
        points_type: 'static',
        points_static: points_static ?? 10,
        points_min: null,
        points_max: null,
        config: {
          ...(timeSeconds ? { timer_seconds: timeSeconds } : {}),
        },
        groupName,
      }
      const draft: QuizDraft = { game, questions: [q], firstRow: rowNo }
      quizByName.set(name.toLowerCase(), draft)
      games.push(game)
      continue
    }

    const config: GameConfig = {}
    if (type === 'video' && timeSeconds) config.max_video_duration_seconds = timeSeconds
    if (type === 'text') {
      if (answers.length === 0) {
        errors.push(
          `Row ${rowNo} (${name}): text games need Answers — accepted answers separated by |, plus a Correct answer if it is multiple choice.`,
        )
        continue
      }
      if (correct) {
        if (!answers.includes(correct)) {
          errors.push(
            `Row ${rowNo} (${name}): Correct answer must exactly match one of the Answers.`,
          )
          continue
        }
        if (answers.length < 2 || answers.length > 6) {
          errors.push(`Row ${rowNo} (${name}): multiple choice needs 2-6 Answers.`)
          continue
        }
        const options = answers.map((text) => ({ id: crypto.randomUUID(), text }))
        config.text_answer_mode = 'choose_answer'
        config.text_options = options
        config.text_correct_answer_id = options[answers.indexOf(correct)].id
      } else {
        config.text_answer_mode = 'type_text'
        config.text_correct_answers = answers
      }
    }

    games.push({
      name,
      type,
      description,
      points_type,
      points_static,
      points_min,
      points_max,
      config,
      groupName,
    })
  }

  // Quiz games attach their collected questions at the end.
  for (const draft of quizByName.values()) {
    draft.game.config.questions = draft.questions
  }

  const groupNames = [...new Set(games.map((g) => g.groupName).filter((g): g is string => !!g))]
  return { games, errors, groupNames }
}
