import { supabase } from '@/lib/supabase'
import type { TablesInsert } from '@/types/helpers'

export type DiagnosticContext =
  | 'join-team-photo'
  | 'submission-upload'
  | 'text-submit'
  | 'photo-capture'
  | 'video-record'

export type DiagnosticPlatform = 'ios' | 'android' | 'desktop' | 'other'

export type DiagnosticExtra = Record<string, string | number | boolean | null>

export type DiagnosticOptions = {
  eventId?: string | null
  teamId?: string | null
  extra?: DiagnosticExtra
}

/** Coarse platform tag for filtering client_diagnostics rows. */
export function detectPlatform(): DiagnosticPlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Macintosh|Windows|Linux/i.test(ua) && !/Mobi/i.test(ua)) return 'desktop'
  return 'other'
}

/** Short human-readable summary, safe to append to an existing notify() message. */
export function diagnosticSummary(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/** Builds the exact row reportClientIssue inserts — exported for isolated testing. */
export function buildDiagnosticPayload(
  context: DiagnosticContext,
  error: unknown,
  options?: DiagnosticOptions,
): TablesInsert<'client_diagnostics'> {
  const name = error instanceof Error ? error.name : 'UnknownError'
  const stack = error instanceof Error && error.stack ? error.stack.slice(0, 2000) : null

  return {
    event_id: options?.eventId ?? null,
    team_id: options?.teamId ?? null,
    context,
    platform: detectPlatform(),
    message: diagnosticSummary(error),
    detail: {
      name,
      stack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      extra: options?.extra ?? null,
    },
  }
}

/**
 * Fire-and-forget: captures a currently-mysterious client failure to
 * `client_diagnostics` and returns a short summary the caller can append to
 * their existing notify() message. Never throws and never awaits the insert
 * in a way that could block the caller — losing a diagnostic row is
 * acceptable, hanging the UI to log one is not.
 */
export function reportClientIssue(
  context: DiagnosticContext,
  error: unknown,
  options?: DiagnosticOptions,
): string {
  try {
    const payload = buildDiagnosticPayload(context, error, options)
    void supabase
      .from('client_diagnostics')
      .insert(payload)
      .then(
        () => {},
        () => {},
      )
  } catch {
    // Logging must never break the caller's flow.
  }
  return diagnosticSummary(error)
}
