export type QuizAnswer = { id: string; text: string }

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

export type BonusChallenge = {
  id: string
  mediaType: 'photo' | 'video'
  question: string
  answers: QuizAnswer[]
  correctAnswerId: string
  mediaUrl?: string | null
  questionImageUrl?: string | null
}

export type GameConfig = {
  example_video_url?: string | null
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
  bonus_challenges?: BonusChallenge[]
  /** null = not chosen yet; 30 or 90 sec clips to generate. */
  bingo_clip_length?: 30 | 90 | null
  /** Each entry is five cell indices (0–24) for a winning line. */
  bingo_winning_lines?: number[][]
  bingo_line_points?: number
  bingo_points_per_correct?: number
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
}
