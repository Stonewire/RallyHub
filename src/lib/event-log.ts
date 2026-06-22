import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/json'

type LogArgs = {
  p_event_id: string
  p_actor_type: 'team' | 'facilitator' | 'admin' | 'system'
  p_actor_name: string
  p_action: string
  p_actor_id?: string | null
  p_details?: Json | null
}

/**
 * Event activity logging. Unlike a bare `void supabase.rpc(...)`, this surfaces
 * failures in the console — a silently-swallowed RPC error is exactly why the
 * event log kept "recording nothing" with no way to tell why (F9, and again).
 * Still non-blocking at the call site (callers use `void logEventActivity(...)`).
 */
export async function logEventActivity(args: LogArgs): Promise<void> {
  const { error } = await supabase.rpc('log_event_activity', args)
  if (error) {
    console.warn(`[event-log] "${args.p_action}" write failed`, error)
  }
}
