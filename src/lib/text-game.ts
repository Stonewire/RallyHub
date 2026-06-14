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
  return mediaType === 'photo' || mediaType === 'video' || mediaType === 'text'
}
