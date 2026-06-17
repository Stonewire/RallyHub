import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url?.trim() || !anonKey?.trim()) {
  console.warn(
    '[RallyHub] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env',
  )
}

let liveJoinToken: string | null = null

function isSupabaseAuthRequest(input: RequestInfo | URL): boolean {
  const requestUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  return requestUrl.includes('/auth/v1/')
}

/** Sets the join token sent on Supabase REST requests (x-join-token header for Phase 2 RLS). */
export function setLiveJoinToken(token: string | null): void {
  liveJoinToken = token?.trim() || null
}

export const supabase = createClient<Database>(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  {
    global: {
      fetch: (input, init) => {
        if (!liveJoinToken || isSupabaseAuthRequest(input)) {
          return fetch(input, init)
        }
        const headers = new Headers(init?.headers)
        headers.set('x-join-token', liveJoinToken)
        return fetch(input, { ...init, headers })
      },
    },
  },
)
