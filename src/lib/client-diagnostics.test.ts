import { describe, expect, it, vi } from 'vitest'

import {
  buildDiagnosticPayload,
  detectPlatform,
  DiagnosticReportedError,
  diagnosticSummary,
  reportClientIssue,
} from '@/lib/client-diagnostics'
import { supabase } from '@/lib/supabase'

describe('diagnosticSummary', () => {
  it('formats an Error as "Name: message"', () => {
    const err = new TypeError('Failed to fetch')
    expect(diagnosticSummary(err)).toBe('TypeError: Failed to fetch')
  })

  it('stringifies a non-Error throwable', () => {
    expect(diagnosticSummary('plain string failure')).toBe('plain string failure')
  })
})

describe('buildDiagnosticPayload', () => {
  it('captures context, message, and a null event/team id when not provided', () => {
    const err = new Error('boom')
    const payload = buildDiagnosticPayload('photo-capture', err)
    expect(payload.context).toBe('photo-capture')
    expect(payload.message).toBe('Error: boom')
    expect(payload.event_id).toBeNull()
    expect(payload.team_id).toBeNull()
    const detail = payload.detail as { name: string; stack: string | null }
    expect(detail.name).toBe('Error')
    expect(typeof detail.stack === 'string' || detail.stack === null).toBe(true)
  })

  it('carries event/team ids and extra context through when provided', () => {
    const payload = buildDiagnosticPayload('submission-upload', new Error('x'), {
      eventId: 'event-1',
      teamId: 'team-1',
      extra: { mediaType: 'video' },
    })
    expect(payload.event_id).toBe('event-1')
    expect(payload.team_id).toBe('team-1')
    const detail = payload.detail as { extra: Record<string, unknown> }
    expect(detail.extra).toEqual({ mediaType: 'video' })
  })
})

describe('DiagnosticReportedError', () => {
  it('is an Error subclass carrying the given message and a marker name', () => {
    const err = new DiagnosticReportedError('Could not upload submission (boom)')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(DiagnosticReportedError)
    expect(err.name).toBe('DiagnosticReportedError')
    expect(err.message).toBe('Could not upload submission (boom)')
  })

  it('preserves the cause option so the original error is not lost', () => {
    const cause = new Error('original failure')
    const err = new DiagnosticReportedError('wrapped', { cause })
    expect(err.cause).toBe(cause)
  })
})

describe('detectPlatform', () => {
  it('returns one of the four known platform tags', () => {
    expect(['ios', 'android', 'desktop', 'other']).toContain(detectPlatform())
  })
})

describe('reportClientIssue', () => {
  it('never throws even when the underlying insert rejects', () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: () => Promise.reject(new Error('insert failed')),
    } as never)
    expect(() => reportClientIssue('photo-capture', new Error('boom'))).not.toThrow()
    vi.restoreAllMocks()
  })

  it('never throws even when supabase.from itself throws synchronously', () => {
    vi.spyOn(supabase, 'from').mockImplementation(() => {
      throw new Error('client unavailable')
    })
    expect(() => reportClientIssue('video-record', new Error('boom'))).not.toThrow()
    vi.restoreAllMocks()
  })

  it('returns the same summary diagnosticSummary would produce', () => {
    const err = new Error('boom')
    expect(reportClientIssue('video-record', err)).toBe(diagnosticSummary(err))
  })
})
