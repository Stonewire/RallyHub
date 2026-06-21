import type { GameConfig } from '@/types/game-config'

export type BingoLiveState = string

export function bingoSongProgress(playIndex: number, total: number): string {
  if (total <= 0) return '0 / 0 songs'
  return `${Math.min(playIndex + 1, total)} / ${total} songs played`
}

export function parseBingoGameConfig(config: unknown): GameConfig {
  return (config ?? {}) as GameConfig
}
