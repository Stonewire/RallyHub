import { supabase, setLiveJoinToken } from '@/lib/supabase'

const joinTokenStorageKey = (eventId: string) => `rallyhub_join_token_${eventId}`

/** Read cached join token for an event (does not set the request header). */
export function getStoredLiveJoinToken(eventId: string): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(joinTokenStorageKey(eventId))
}

/** Bootstrap or restore per-event join token for anon live panels (header + sessionStorage). */
export async function ensureLiveEventAccess(eventId: string): Promise<boolean> {
  const stored = getStoredLiveJoinToken(eventId)
  if (stored) {
    setLiveJoinToken(stored)
    return true
  }

  const { data, error } = await supabase.rpc('bootstrap_live_event_access', {
    p_event_id: eventId,
  })
  if (error || !data || typeof data !== 'string') {
    setLiveJoinToken(null)
    return false
  }

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(joinTokenStorageKey(eventId), data)
  }
  setLiveJoinToken(data)
  return true
}
