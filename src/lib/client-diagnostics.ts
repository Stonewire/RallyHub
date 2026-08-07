import { supabase } from '@/lib/supabase'
import { APP_VERSION } from '@/lib/version'
import type { TablesInsert } from '@/types/helpers'

export type DiagnosticContext =
  | 'join-team-photo'
  | 'submission-upload'
  | 'text-submit'
  | 'photo-capture'
  | 'video-record'
  | 'capture-timing'
  | 'submit-timing'
  | 'record-timing'

export type DiagnosticPlatform = 'ios' | 'android' | 'desktop' | 'other'

export type DiagnosticExtra = Record<string, string | number | boolean | null>

export type DiagnosticOptions = {
  eventId?: string | null
  teamId?: string | null
  extra?: DiagnosticExtra
}

/**
 * Thrown by an inner wrapper that has already called reportClientIssue, so an
 * outer catch can tell "already reported, just show this message" apart from
 * "not yet reported, report it now" without fragile string matching.
 */
export class DiagnosticReportedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DiagnosticReportedError'
  }
}

/**
 * performance.now() for timing user-gesture code paths (submit handlers,
 * shutter presses). Lives here because react-hooks/purity cannot distinguish
 * those handlers from render scope and flags direct performance.now() calls in
 * component bodies; none of the timing callers run during render.
 */
export function nowMs(): number {
  return performance.now()
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
  // Supabase errors are plain objects, not Error instances; String() turned
  // them into "[object Object]" in every diagnostic row from the 7 Aug event.
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; error_description?: unknown; code?: unknown; hint?: unknown }
    const parts = [e.message, e.error_description, e.code]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (parts.length > 0) return parts.join(' | ').slice(0, 300)
    try {
      return JSON.stringify(error).slice(0, 300)
    } catch {
      return 'UnserializableError'
    }
  }
  return String(error)
}

/**
 * A failure that smells like connectivity rather than the app: fetch's
 * TypeError, Safari's "Load failed", or the device reporting itself offline.
 * Used to show teams "check the wifi" instead of a diagnostic reference.
 */
export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const text = diagnosticSummary(error).toLowerCase()
  return (
    text.includes('load failed') ||
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('timeout') ||
    text.includes('fetcherror')
  )
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
      appVersion: APP_VERSION,
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

/**
 * Fire-and-forget timing capture for stages that complete but take too long
 * (slow shutter, submit screens that linger, late realtime echoes). Same
 * never-throw / never-block contract as reportClientIssue; callers gate on a
 * threshold themselves so normal-speed runs produce no rows.
 */
export function reportClientTiming(
  context: DiagnosticContext,
  message: string,
  options?: DiagnosticOptions,
): void {
  try {
    void supabase
      .from('client_diagnostics')
      .insert({
        event_id: options?.eventId ?? null,
        team_id: options?.teamId ?? null,
        context,
        platform: detectPlatform(),
        message,
        detail: {
          name: 'Timing',
          stack: null,
          appVersion: APP_VERSION,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          extra: options?.extra ?? null,
        },
      })
      .then(
        () => {},
        () => {},
      )
  } catch {
    // Logging must never break the caller's flow.
  }
}
