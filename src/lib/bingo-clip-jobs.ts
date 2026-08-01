import { useSyncExternalStore } from 'react'

import { ensureMusicTrackClip, type BingoClipLength } from '@/lib/music-track-clips'
import type { MusicTrack } from '@/types/game-config'

export type ClipJobs = {
  /** track id -> 0..1. A track only appears while its clip is being cut. */
  progress: Record<string, number>
  running: boolean
  error: string | null
}

const EMPTY: ClipJobs = { progress: {}, running: false, error: null }

/**
 * Clip cutting is shared state because the bingo editor renders in two places
 * at once: the settings card (with the Regenerate button) and the track card
 * (which draws a progress fill on each row). They are separate React trees, so
 * a plain useState in either one leaves the other blind.
 *
 * ponytail: a module-level store rather than a context, because only one game
 * editor is ever open at a time.
 */
let state: ClipJobs = EMPTY
const listeners = new Set<() => void>()

function setState(next: Partial<ClipJobs>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useClipJobs(): ClipJobs {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  )
}

export function clearClipJobError() {
  if (state.error) setState({ error: null })
}

/**
 * Cuts a clip per track, saving each as it lands so a failure part way keeps
 * the work already done.
 */
export async function runClipJobs(
  tracks: MusicTrack[],
  organizationId: string,
  length: BingoClipLength,
  onTrack: (track: MusicTrack) => void,
): Promise<void> {
  if (tracks.length === 0 || state.running) return
  // Every queued track shows at zero so the whole batch is visible from the
  // start, not just the one being worked on.
  setState({
    running: true,
    error: null,
    progress: Object.fromEntries(tracks.map((t) => [t.id, 0])),
  })
  try {
    for (const track of tracks) {
      const next = await ensureMusicTrackClip(track, organizationId, length, (fraction) =>
        setState({ progress: { ...state.progress, [track.id]: fraction } }),
      )
      onTrack(next)
      const rest = { ...state.progress }
      delete rest[track.id]
      setState({ progress: rest })
    }
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'Clip generation failed' })
  } finally {
    setState({ running: false, progress: {} })
  }
}
