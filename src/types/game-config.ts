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
}

export type BonusChallenge = {
  id: string
  mediaType: 'photo' | 'video'
  question: string
  answers: QuizAnswer[]
  correctAnswerId: string
  mediaUrl?: string | null
  /** Photo shown with the question (photo challenges). */
  questionImageUrl?: string | null
}

export type GameConfig = {
  example_video_url?: string | null
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
  /** Open stages: multiple photo/video games. */
  gameIds?: string[]
  message?: string
  durationMinutes?: number
}
