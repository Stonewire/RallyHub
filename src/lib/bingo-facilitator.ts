import type { GameConfig } from '@/types/game-config'

export type BingoLiveState = string

export function bingoSongProgress(playIndex: number, total: number): string {
  if (total <= 0) return '0 / 0 songs'
  return `${Math.min(playIndex + 1, total)} / ${total} songs played`
}

export function bingoPrimaryAction(params: {
  bingoState: BingoLiveState
  playIndex: number
  playOrderLength: number
  songsStarted: boolean
}): { label: string; action: 'play' | 'reveal' | 'next' | 'end' } | null {
  const { bingoState, playIndex, playOrderLength, songsStarted } = params

  if (bingoState === 'bonus' || bingoState === 'bonus_revealed') return null

  if (bingoState === 'playing') {
    return { label: 'Reveal', action: 'reveal' }
  }

  if (bingoState === 'revealed') {
    const isLast = playIndex >= playOrderLength - 1
    if (isLast) return { label: 'End bingo', action: 'end' }
    return { label: 'Next song', action: 'next' }
  }

  if (bingoState === 'waiting' || bingoState === 'active' || !songsStarted) {
    if (!songsStarted || playIndex === 0) {
      return { label: 'Play first song', action: 'play' }
    }
    return { label: 'Play song', action: 'play' }
  }

  return { label: 'Play song', action: 'play' }
}

export function parseBingoGameConfig(config: unknown): GameConfig {
  return (config ?? {}) as GameConfig
}
