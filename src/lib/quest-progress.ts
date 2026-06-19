import { isOpenStageSubmissionMediaType } from '@/lib/text-game'
import type { Tables } from '@/types/helpers'

export type QuestGameStatus = 'approved' | 'pending' | 'rejected' | 'none'

export type QuestGameProgress = {
  game: Tables<'games'>
  status: QuestGameStatus
  /** The submission backing the status (approved/pending/rejected). Null when not started. */
  submission: Tables<'submissions'> | null
}

export type TeamQuestProgress = {
  items: QuestGameProgress[]
  /** Games with an approved submission. */
  doneCount: number
  total: number
  /** 0–100 completion for the cell fill. */
  percent: number
}

type StageLike = {
  type?: string | null
  gameId?: string | null
  gameIds?: string[] | null
}

/** Games referenced by Quest (open) stages, de-duplicated, in stage order. */
export function questGamesForEvent(
  stages: StageLike[],
  games: Tables<'games'>[],
): Tables<'games'>[] {
  const ids: string[] = []
  for (const stage of stages) {
    if (stage?.type !== 'open') continue
    const stageIds =
      stage.gameIds && stage.gameIds.length > 0
        ? stage.gameIds
        : stage.gameId
          ? [stage.gameId]
          : []
    for (const id of stageIds) {
      if (id && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
    .map((id) => games.find((g) => g.id === id))
    .filter((g): g is Tables<'games'> => Boolean(g))
}

/** Per-Quest-game status for one team, plus the completion summary for the cell fill. */
export function teamQuestProgress(
  teamId: string,
  questGames: Tables<'games'>[],
  submissions: Tables<'submissions'>[],
): TeamQuestProgress {
  const items: QuestGameProgress[] = questGames.map((game) => {
    const teamSubs = submissions.filter(
      (s) =>
        s.team_id === teamId &&
        s.game_id === game.id &&
        isOpenStageSubmissionMediaType(s.media_type) &&
        s.status !== 'cancelled',
    )
    const approved = teamSubs.find((s) => s.status === 'approved')
    const pending = teamSubs.find((s) => s.status === 'pending')
    const rejected = teamSubs.find((s) => s.status === 'rejected')
    if (approved) return { game, status: 'approved', submission: approved }
    if (pending) return { game, status: 'pending', submission: pending }
    if (rejected) return { game, status: 'rejected', submission: rejected }
    return { game, status: 'none', submission: null }
  })
  const total = questGames.length
  const doneCount = items.filter((i) => i.status === 'approved').length
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0
  return { items, doneCount, total, percent }
}
