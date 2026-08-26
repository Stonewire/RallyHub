// The download-on-join answer package (OFFLINE-1 Stage 2).
//
// After a team joins, the device pulls the answer data that offline auto-scoring
// needs — the fields redact_game_config_for_live strips from the live payload —
// and stores it in IndexedDB. Text answers arrive as sha256 hashes (never
// plaintext); puzzles arrive as their answer fields. The server RPC
// get_offline_event_package gates this on a valid private team token, so it only
// works once you have actually joined the event.
//
// Stage 4 reads these keys to score text and puzzle submissions on the device.

import { supabase } from '@/lib/supabase'

import { idbGet, idbSet } from './idb'
import { beginOfflineDownload, type OfflineArtefactProbe } from './readiness'

/** Per game id, exactly the answer fields redaction removed. Shape mirrors the
 *  RPC's `answerKeys` map. */
export type OfflineAnswerKey = {
  text_correct_answer_hashes?: string[]
  text_correct_answer_id?: string
  puzzle_wordle_answer?: string
  puzzle_matching_pairs?: unknown
  puzzle_crossword_words?: unknown
}

export type OfflineAnswerKeys = Record<string, OfflineAnswerKey>

type StoredPackage = { answerKeys: OfflineAnswerKeys; savedAt: string }

const contentKey = (eventId: string) => `answers:${eventId}`

/** Fetch the answer package for an event and persist it. Best-effort: returns
 *  null (and leaves any previously-stored copy intact) if the RPC fails, the
 *  caller is not a joined team, or storage is unavailable — offline scoring
 *  simply stays unavailable rather than breaking the join. */
export async function downloadOfflineAnswerKeys(
  eventId: string,
  savedAtIso: string,
): Promise<OfflineAnswerKeys | null> {
  const done = beginOfflineDownload('answer-package', eventId, hasStoredAnswerKeys)
  try {
    const { data, error } = await supabase.rpc('get_offline_event_package', {
      p_event_id: eventId,
    })
    if (error || !data) {
      done(false)
      return null
    }
    const answerKeys = (data as { answerKeys?: OfflineAnswerKeys }).answerKeys ?? {}
    await idbSet('content', contentKey(eventId), { answerKeys, savedAt: savedAtIso })
    done(true)
    return answerKeys
  } catch {
    // Matches the documented contract above: storage or transport trouble
    // yields null, never a rejection the fire-and-forget callers cannot catch.
    done(false)
    return null
  }
}

/** Readiness probe: is an answer package for this event actually stored. */
const hasStoredAnswerKeys: OfflineArtefactProbe = async (eventId) =>
  (await idbGet<StoredPackage>('content', contentKey(eventId))) !== undefined

/** The stored answer keys for an event, or null if none downloaded yet. */
export async function getOfflineAnswerKeys(eventId: string): Promise<OfflineAnswerKeys | null> {
  const rec = await idbGet<StoredPackage>('content', contentKey(eventId))
  return rec?.answerKeys ?? null
}
