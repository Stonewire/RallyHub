import type { PostgrestError } from '@supabase/supabase-js'

function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as PostgrestError).message === 'string'
  )
}

/** Human-readable Supabase / PostgREST error for UI and logs. */
export function formatSupabaseError(err: unknown): string {
  if (isPostgrestError(err)) {
    const parts = [err.message]
    if (err.details) parts.push(err.details)
    if (err.hint) parts.push(err.hint)
    if (err.code) parts.push(`code ${err.code}`)
    return parts.join(' — ')
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Unknown error'
}

export function logSupabaseFailure(context: string, err: unknown) {
  console.error(`[${context}]`, err)
}
