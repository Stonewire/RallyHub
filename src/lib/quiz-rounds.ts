import type { GameConfig, QuizQuestion, QuizRound } from '@/types/game-config'
import type { Tables } from '@/types/helpers'

import { quizQuestions } from '@/lib/live-event'

export function quizConfig(game: Tables<'games'> | null | undefined): GameConfig {
  return (game?.config ?? {}) as GameConfig
}

export function quizRoundById(game: Tables<'games'>, roundId: string | null | undefined): QuizRound | null {
  if (!roundId) return null
  return quizConfig(game).rounds?.find((r) => r.id === roundId) ?? null
}

export function quizRoundForQuestionIndex(
  game: Tables<'games'>,
  index: number,
): QuizRound | null {
  const q = quizQuestions(game)[index]
  return q ? quizRoundById(game, q.roundId) : null
}

export function isLastQuestionInRound(game: Tables<'games'> | null, index: number): boolean {
  if (!game) return false
  const config = quizConfig(game)
  if (!config.rounds_enabled) return false
  const qs = quizQuestions(game)
  const current = qs[index]
  if (!current?.roundId) return false
  const next = qs[index + 1]
  return !next || next.roundId !== current.roundId
}

export function roundIntroDisplay(
  round: QuizRound,
  roundIndex: number,
): { title: string; subtitle: string } {
  const name = round.name.trim()
  const numbered = name.match(/^round\s+(\d+)\s*(?::\s*(.+))?$/i)
  if (numbered) {
    const subtitle = numbered[2]?.trim() || name
    return { title: `ROUND ${numbered[1]}`, subtitle }
  }
  return { title: `ROUND ${roundIndex + 1}`, subtitle: name }
}

export function roundIndexForQuestion(game: Tables<'games'>, question: QuizQuestion | undefined): number {
  if (!question?.roundId) return 0
  const rounds = quizConfig(game).rounds ?? []
  const idx = rounds.findIndex((r) => r.id === question.roundId)
  return idx >= 0 ? idx : 0
}
