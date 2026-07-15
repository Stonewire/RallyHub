import { describe, expect, it } from 'vitest'

import type { EventRow } from '@/hooks/use-events'

import { isActivationBillingRequired } from './event-activation-billing'
import {
  canTransitionEventStatus,
  getAllowedEventStatuses,
  isEventActivated,
} from './event-lifecycle'

/**
 * Regression cover for keeping event lifecycle independent from invoice state.
 * Activation is represented only by activated_at.
 */
function event(partial: Partial<EventRow>): Pick<EventRow, 'status' | 'activated_at'> {
  return { status: 'ready', activated_at: null, ...partial } as Pick<
    EventRow,
    'status' | 'activated_at'
  >
}

describe('event lifecycle keys off activated_at, not invoiced_at', () => {
  it('an invoiced-but-not-yet-live event can still be activated', () => {
    const paidNotLive = event({ status: 'ready', activated_at: null })

    expect(isEventActivated(paidNotLive)).toBe(false)
    expect(getAllowedEventStatuses(paidNotLive)).toContain('active')
    expect(canTransitionEventStatus(paidNotLive, 'active')).toBe(true)
  })

  it('an event that has actually run is locked to archived', () => {
    const live = event({ status: 'active', activated_at: '2026-07-14T10:00:00Z' })

    expect(isEventActivated(live)).toBe(true)
    expect(getAllowedEventStatuses(live)).toEqual(['active', 'archived'])
    expect(canTransitionEventStatus(live, 'ready')).toBe(false)
  })

  it('an archived event stays archived', () => {
    const archived = event({ status: 'archived', activated_at: '2026-07-14T10:00:00Z' })
    expect(getAllowedEventStatuses(archived)).toEqual(['archived'])
  })
})

describe('isActivationBillingRequired', () => {
  it('still prompts (and collects payment) for an event that has not gone live', () => {
    // An invoice may exist, but the event has not run yet.
    expect(isActivationBillingRequired('ready', 'active', null)).toBe(true)
  })

  it('does not re-bill an event that already went live', () => {
    expect(isActivationBillingRequired('active', 'active', '2026-07-14T10:00:00Z')).toBe(false)
  })

  it('is not required for non-activation transitions', () => {
    expect(isActivationBillingRequired('ready', 'archived', null)).toBe(false)
  })
})
