import type { GameConfig, TextAnswerMode } from '@/types/game-config'
import type { Json } from '@/types/json'
import type { Tables } from '@/types/helpers'

export type ParsedTextGameConfig = {
  mode: TextAnswerMode
  correctAnswers: string[]
  options: GameConfig['text_options']
  correctAnswerId: string
}

export function parseTextGameConfig(
  config: GameConfig | Json | null | undefined,
): ParsedTextGameConfig {
  const c = (config ?? {}) as GameConfig
  const options = c.text_options ?? []
  return {
    mode: c.text_answer_mode ?? 'type_text',
    correctAnswers: c.text_correct_answers ?? [],
    options,
    correctAnswerId:
      c.text_correct_answer_id ?? options[0]?.id ?? '',
  }
}

/** Open-stage text game: by type column or text answer config in jsonb. */
export function isTextGame(
  game: Pick<Tables<'games'>, 'type' | 'config'>,
): boolean {
  if (game.type === 'text') return true
  const cfg = (game.config ?? {}) as GameConfig
  if (cfg.text_answer_mode === 'choose_answer') {
    return (cfg.text_options?.length ?? 0) >= 2
  }
  if (cfg.text_answer_mode === 'type_text') {
    return (cfg.text_correct_answers ?? []).some((a) => a.length > 0)
  }
  if ((cfg.text_options?.length ?? 0) >= 2) return true
  if ((cfg.text_correct_answers ?? []).some((a) => a.length > 0)) return true
  return false
}

/** Prefer the live bundle copy so type/config updates apply after realtime reload. */
export function resolveGameFromList(
  games: Tables<'games'>[],
  game: Tables<'games'> | null | undefined,
): Tables<'games'> | null {
  if (!game) return null
  return games.find((g) => g.id === game.id) ?? game
}

/** Label shown for a team's text submission (typed text or chosen option). */
export function textSubmissionDisplayLabel(
  game: Tables<'games'>,
  mediaUrl: string | null | undefined,
): string {
  if (!mediaUrl) return ''
  const cfg = parseTextGameConfig(game.config)
  if (cfg.mode === 'choose_answer') {
    const opt = cfg.options?.find((o) => o.id === mediaUrl)
    return opt?.text ?? mediaUrl
  }
  return mediaUrl
}

export function isOpenStageSubmissionMediaType(mediaType: string | null | undefined): boolean {
  return (
    mediaType === 'photo' || mediaType === 'video' || mediaType === 'text' || mediaType === 'puzzle'
  )
}

export function puzzleSubmissionStatLabel(mediaUrl: string | null | undefined): string {
  const [kind, rawValue] = (mediaUrl ?? '').split(':')
  const value = Number.parseInt(rawValue ?? '', 10)
  if (Number.isNaN(value)) return 'Puzzle complete'
  if (kind === 'wordle') return `Solved in ${value} ${value === 1 ? 'guess' : 'guesses'}`
  if (kind === 'matching') return `Matched in ${value} ${value === 1 ? 'attempt' : 'attempts'}`
  if (kind === 'crossword') {
    const minutes = Math.floor(value / 60)
    return `Solved in ${minutes}:${String(value % 60).padStart(2, '0')}`
  }
  return 'Puzzle complete'
}
