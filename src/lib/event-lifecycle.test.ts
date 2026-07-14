import { describe, expect, it } from 'vitest'

import type { EventRow } from '@/hooks/use-events'

import { isActivationBillingRequired } from './event-activation-billing'
import {
  canTransitionEventStatus,
  getAllowedEventStatuses,
  isEventActivated,
} from './event-lifecycle'

/**
 * Regression cover for the Free-plan prepay bug: prepay creates the invoice
 * (setting invoiced_at) BEFORE the event goes live. The lifecycle used to treat
 * invoiced_at as "already run", so a customer who had just paid found their event
 * locked to "Archived" and could never activate it. Activation is activated_at.
 */
function event(partial: Partial<EventRow>): Pick<EventRow, 'status' | 'activated_at'> {
  return { status: 'ready', activated_at: null, ...partial } as Pick<
    EventRow,
    'status' | 'activated_at'
  >
}

describe('event lifecycle keys off activated_at, not invoiced_at', () => {
  it('a paid-but-not-yet-live event can still be activated', () => {
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
    // Free-plan retry after abandoning checkout: an invoice already exists, but
    // the event never ran. They must still be offered the payment.
    expect(isActivationBillingRequired('ready', 'active', null)).toBe(true)
  })

  it('does not re-bill an event that already went live', () => {
    expect(isActivationBillingRequired('active', 'active', '2026-07-14T10:00:00Z')).toBe(false)
  })

  it('is not required for non-activation transitions', () => {
    expect(isActivationBillingRequired('ready', 'archived', null)).toBe(false)
  })
})
