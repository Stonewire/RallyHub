import type { GameConfig, QuizQuestion, QuizRound } from '@/types/game-config'

// Editor-side round surgery. Kept apart from lib/quiz-rounds.ts, which serves
// the live player and reads from a game row rather than editing a config.

/** Questions belonging to a round, in the order the round lists them. */
export function questionsInRound(config: GameConfig, roundId: string): QuizQuestion[] {
  const questions = config.questions ?? []
  const round = (config.rounds ?? []).find((r) => r.id === roundId)
  // roundId on the question is the source of truth; the round's questionIds is
  // an ordering hint, and the two can disagree if one was edited without the
  // other. Anything claiming the round counts, ordered by the hint where it
  // knows, so a stale list can never hide a question from the delete warning.
  const owned = questions.filter((q) => q.roundId === roundId)
  if (!round) return owned
  const order = new Map(round.questionIds.map((id, index) => [id, index]))
  return [...owned].sort(
    (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
}

/**
 * Removes a round.
 *
 * `moveToRoundId` reassigns its questions to another round instead of deleting
 * them. Passing null deletes them with the round, which is only ever reached
 * after the organiser has been told how many they are.
 */
export function removeRound(
  config: GameConfig,
  roundId: string,
  moveToRoundId: string | null,
): GameConfig {
  const doomed = questionsInRound(config, roundId)
  const doomedIds = new Set(doomed.map((q) => q.id))
  const rounds = (config.rounds ?? []).filter((r) => r.id !== roundId)

  if (moveToRoundId && rounds.some((r) => r.id === moveToRoundId)) {
    return {
      ...config,
      rounds: rounds.map((round) =>
        round.id === moveToRoundId
          ? { ...round, questionIds: [...round.questionIds, ...doomed.map((q) => q.id)] }
          : { ...round, questionIds: round.questionIds.filter((id) => !doomedIds.has(id)) },
      ),
      questions: (config.questions ?? []).map((q) =>
        doomedIds.has(q.id) ? { ...q, roundId: moveToRoundId } : q,
      ),
    }
  }

  return {
    ...config,
    // Rounds on with no rounds left is a dead end: the editor draws a
    // placeholder round card that cannot be opened, so New question and
    // Import sit behind a card that never expands. Deleting the last round
    // turns rounds off instead, which is the same quiz without the grouping.
    rounds_enabled: rounds.length > 0 ? config.rounds_enabled : false,
    rounds: rounds.map((round) => ({
      ...round,
      questionIds: round.questionIds.filter((id) => !doomedIds.has(id)),
    })),
    questions: (config.questions ?? []).filter((q) => !doomedIds.has(q.id)),
  }
}

/** Rounds a question could be moved to, i.e. everything but the one going. */
export function moveTargets(config: GameConfig, roundId: string): QuizRound[] {
  return (config.rounds ?? []).filter((r) => r.id !== roundId)
}
