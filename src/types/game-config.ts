export type QuizAnswer = { id: string; text: string }

export type TextAnswerMode = 'type_text' | 'choose_answer'

export type PuzzleType = 'wordle' | 'matching' | 'crossword'

export type PuzzleMatchingPair = {
  id: string
  leftId: string
  rightId: string
  left: string
  right: string
}

export type PuzzleMatchingItem = {
  id: string
  text: string
}

export type CrosswordDirection = 'across' | 'down'

export type PuzzleCrosswordWord = {
  id: string
  answer: string
  clue: string
  row: number
  col: number
  direction: CrosswordDirection
}

export type CrosswordClue = {
  id: string
  number: number
  direction: CrosswordDirection
  row: number
  col: number
  length: number
  clue: string
}

export type CrosswordLayout = {
  cells: { row: number; col: number }[]
  blocked: { row: number; col: number }[]
  clues: CrosswordClue[]
}

export type QuizQuestion = {
  id: string
  text: string
  answers: QuizAnswer[]
  correctAnswerId: string
  photoUrl?: string | null
  roundId?: string | null
}

export type QuizRound = {
  id: string
  name: string
  questionIds: string[]
}

export type MusicTrack = {
  id: string
  title: string
  artist: string
  audioUrl: string
  /** MP3 clip for live bingo. */
  clipUrl?: string | null
  clipStartSeconds?: number
  clipDurationSeconds?: number
}

export type GameConfig = {
  example_video_url?: string | null
  /**
   * Facilitator-only worked answer for video games. Stripped from every live
   * payload by redact_game_config_for_live, unconditionally and for every game
   * type, so it genuinely never reaches a participant.
   */
  solution_video_url?: string | null
  max_video_duration_seconds?: number
  background_url?: string | null
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  timer_seconds?: number
  questions?: QuizQuestion[]
  rounds_enabled?: boolean
  rounds?: QuizRound[]
  tracks?: MusicTrack[]
  /** null = not chosen yet; 30 or 90 sec clips to generate. */
  bingo_clip_length?: 30 | 90 | null
  /** Win condition mode. 'lines' = complete N lines; 'full_house' = all 25 cells. */
  bingo_win_mode?: 'lines' | 'full_house'
  /** How many complete lines are required to win in 'lines' mode (1–12). */
  bingo_lines_required?: number
  /** When true, the two diagonals also count as lines toward the requirement. */
  bingo_include_diagonals?: boolean
  /** @deprecated legacy explicit line picker; read for backward compatibility only. */
  bingo_winning_lines?: number[][]
  bingo_line_points?: number
  bingo_points_per_correct?: number
  /** Open-stage text game: typed exact-match answers or multiple choice. */
  text_answer_mode?: TextAnswerMode
  /** type_text: accepted answers (case and symbols must match exactly). */
  text_correct_answers?: string[]
  /** choose_answer: 2–6 options shown to teams. */
  text_options?: QuizAnswer[]
  text_correct_answer_id?: string
  /** Puzzle subtype. Crossword is reserved but cannot be saved in the first release. */
  puzzle_type?: PuzzleType
  /** Wordle solution; removed from every participant live payload. */
  puzzle_wordle_answer?: string
  /** Derived by the live redactor so players know the grid width without the answer. */
  puzzle_wordle_length?: number
  /** Full private pair map; replaced by independent item lists in live payloads. */
  puzzle_matching_pairs?: PuzzleMatchingPair[]
  puzzle_matching_left_items?: PuzzleMatchingItem[]
  puzzle_matching_right_items?: PuzzleMatchingItem[]
  /** Private crossword words with answers; stripped from every live payload. */
  puzzle_crossword_words?: PuzzleCrosswordWord[]
  /** Public grid layout derived at edit time; safe for participants. */
  puzzle_crossword_layout?: CrosswordLayout
  /** On-screen keyboard alphabet for Wordle/Crossword players. Answer-free. */
  puzzle_keyboard_alphabet?: 'latin' | 'cyrillic'
}

export type EventTeam = {
  id: string
  name: string
  color: string
}

export type EventStage = {
  id: string
  name: string
  type: 'open' | 'quiz' | 'bingo' | 'break'
  gameId?: string | null
  gameIds?: string[]
  message?: string
  durationMinutes?: number
  /** Extra seconds on top of durationMinutes. Absent means zero. */
  durationSeconds?: number
}
