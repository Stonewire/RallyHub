import type { GameType } from '@/types/database'

/**
 * Colour per game type for the type tag on cards.
 *
 * Kept here rather than inline so every surface that shows a type badge reads
 * from one place. Each pairs a solid background with white text, which is what
 * the design shows, and every value is a fixed colour rather than a theme token
 * because the tag sits on top of a cover photo in both light and dark mode.
 */
export const GAME_TYPE_TAG_CLASS: Record<GameType, string> = {
  photo: 'bg-[#e0507e]',
  video: 'bg-[#2f7fd8]',
  quiz: 'bg-[#6b4fd8]',
  music_bingo: 'bg-[#d97a1e]',
  text: 'bg-[#2f9e6e]',
  puzzle: 'bg-[#1a9aa8]',
}

export function gameTypeTagClass(type: GameType | string): string {
  return GAME_TYPE_TAG_CLASS[type as GameType] ?? 'bg-nm-slate-800'
}
