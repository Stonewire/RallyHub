import { createClient } from '@supabase/supabase-js'

import { getCurrentParticipantSession } from '@/lib/participant-session'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url?.trim() || !anonKey?.trim()) {
  console.warn(
    '[RallyHub] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env',
  )
}

let liveJoinToken: string | null = null
let participantAnonMode = false

const resolvedAnonKey = anonKey || 'placeholder'

function requestUrlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

function isSupabaseAuthRequest(input: RequestInfo | URL): boolean {
  return requestUrlOf(input).includes('/auth/v1/')
}

/**
 * x-team-token is read by Postgres out of `request.headers`, so only REST and RPC
 * calls need it. Sending it anywhere else breaks the request outright: Edge
 * Functions and Storage answer the CORS preflight with a fixed
 * Access-Control-Allow-Headers list that does not include x-team-token, so the
 * browser passes the preflight and then refuses to send the real request. That
 * killed every photo/video submission and every participant upload.
 */
export function acceptsTeamTokenHeader(input: RequestInfo | URL): boolean {
  return requestUrlOf(input).includes('/rest/v1/')
}

/** Sets the join token sent on Supabase REST requests (x-join-token header for Phase 2 RLS). */
export function setLiveJoinToken(token: string | null): void {
  liveJoinToken = token?.trim() || null
}

/**
 * Participant/display pages are anonymous by design. If the same browser also has
 * a logged-in session (e.g. a facilitator testing the join flow in another tab),
 * Supabase would otherwise attach that JWT and run participant writes as the
 * `authenticated` role — which Phase 3 RLS does not grant submission INSERT, so the
 * write fails (403/42501). Forcing the anon key here keeps participant requests on
 * the anon + join-token policies regardless of any session.
 */
export function setLiveParticipantMode(enabled: boolean): void {
  participantAnonMode = enabled
}

export const supabase = createClient<Database>(
  url || 'https://placeholder.supabase.co',
  resolvedAnonKey,
  {
    global: {
      fetch: (input, init) => {
        if (isSupabaseAuthRequest(input)) {
          return fetch(input, init)
        }
        if (!liveJoinToken && !participantAnonMode) {
          return fetch(input, init)
        }
        const headers = new Headers(init?.headers)
        if (liveJoinToken) {
          headers.set('x-join-token', liveJoinToken)
        }
        if (participantAnonMode) {
          headers.set('Authorization', `Bearer ${resolvedAnonKey}`)
          // Prove team ownership on participant writes: the private per-device
          // team token minted at claim, verified by digest server-side.
          const session = getCurrentParticipantSession()
          if (session?.purchaseToken && acceptsTeamTokenHeader(input)) {
            headers.set('x-team-token', session.purchaseToken)
          }
        }
        return fetch(input, { ...init, headers })
      },
    },
  },
)
