import { describe, expect, it } from 'vitest'

import { applyLiveBundlePatch, type LiveBundlePatch } from '@/lib/live-broadcast'
import type { LiveEventBundle } from '@/lib/live-event'
import type { Tables } from '@/types/helpers'

function submissionRow(id: string, status: string): Tables<'submissions'> {
  return { id, status } as Tables<'submissions'>
}

/**
 * These cover the exact patch shapes JoinGameView's mergeOwnSubmission applies
 * locally on every submit/cancel — the fix for the submit-delay bug depends on
 * this local merge being correct independent of whether the broadcast fan-out
 * (a separate, now fire-and-forget network call) ever lands.
 */

function bundleWithSubs(subs: { id: string; status: string }[]): LiveEventBundle {
  return {
    event: {} as LiveEventBundle['event'],
    organization: null,
    state: {} as LiveEventBundle['state'],
    teams: [],
    games: [],
    submissions: subs as LiveEventBundle['submissions'],
  }
}

describe('applyLiveBundlePatch — submission INSERT/UPDATE/DELETE', () => {
  it('INSERT adds a new row to the front of submissions', () => {
    const bundle = bundleWithSubs([{ id: 'existing', status: 'pending' }])
    const patch: LiveBundlePatch = {
      kind: 'submission',
      op: 'INSERT',
      row: submissionRow('new', 'pending'),
    }
    const next = applyLiveBundlePatch(bundle, patch)
    expect(next.submissions.map((s) => s.id)).toEqual(['new', 'existing'])
  })

  it('UPDATE replaces the row in place by id (e.g. pending -> cancelled)', () => {
    const bundle = bundleWithSubs([
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'pending' },
    ])
    const next = applyLiveBundlePatch(bundle, {
      kind: 'submission',
      op: 'UPDATE',
      row: submissionRow('a', 'cancelled'),
    })
    expect(next.submissions.map((s) => ({ id: s.id, status: (s as { status: string }).status }))).toEqual([
      { id: 'a', status: 'cancelled' },
      { id: 'b', status: 'pending' },
    ])
  })

  it('UPDATE for a row not yet present inserts it (handles out-of-order patches)', () => {
    const bundle = bundleWithSubs([])
    const next = applyLiveBundlePatch(bundle, {
      kind: 'submission',
      op: 'UPDATE',
      row: submissionRow('late', 'approved'),
    })
    expect(next.submissions.map((s) => s.id)).toEqual(['late'])
  })

  it('DELETE removes only the matching row', () => {
    const bundle = bundleWithSubs([
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'pending' },
    ])
    const next = applyLiveBundlePatch(bundle, {
      kind: 'submission',
      op: 'DELETE',
      old: { id: 'a' },
    })
    expect(next.submissions.map((s) => s.id)).toEqual(['b'])
  })

  it('is idempotent: applying the same INSERT twice does not duplicate the row', () => {
    const bundle = bundleWithSubs([])
    const patch: LiveBundlePatch = {
      kind: 'submission',
      op: 'INSERT',
      row: submissionRow('x', 'pending'),
    }
    const once = applyLiveBundlePatch(bundle, patch)
    const twice = applyLiveBundlePatch(once, patch)
    expect(twice.submissions.map((s) => s.id)).toEqual(['x'])
  })

  it('a local optimistic UPDATE and a later echo of the same row converge to one entry', () => {
    // Simulates mergeOwnSubmission's local patch, followed by the broadcast
    // echo of the same row landing afterwards (self: true) - must not duplicate.
    let bundle = bundleWithSubs([{ id: 'a', status: 'pending' }])
    bundle = applyLiveBundlePatch(bundle, {
      kind: 'submission',
      op: 'UPDATE',
      row: submissionRow('a', 'cancelled'),
    })
    bundle = applyLiveBundlePatch(bundle, {
      kind: 'submission',
      op: 'UPDATE',
      row: submissionRow('a', 'cancelled'),
    })
    expect(bundle.submissions).toHaveLength(1)
    expect((bundle.submissions[0] as { status: string }).status).toBe('cancelled')
  })
})
