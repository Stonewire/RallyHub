import { describe, expect, it } from 'vitest'

import { formatLimitResetDate, friendlyActivationError } from './event-activation-billing'

describe('formatLimitResetDate', () => {
  it('returns the 1st of next month', () => {
    expect(formatLimitResetDate(new Date('2026-07-14T10:00:00Z'))).toBe('1 August 2026')
  })

  it('rolls over the year from December', () => {
    expect(formatLimitResetDate(new Date('2026-12-20T10:00:00Z'))).toBe('1 January 2027')
  })
})

// The raw strings below are exactly what assert_event_activation_allowed raises
// (migration 20260714150000_pay1_free_plan_prepay.sql). If the SQL messages
// change, these break — which is the point.
describe('friendlyActivationError', () => {
  it('explains a missing/lapsed subscription', () => {
    const out = friendlyActivationError(
      'SUBSCRIPTION_REQUIRED: Start a subscription (paid for the current period) before activating events.',
    )
    expect(out).toContain('subscription is not active')
    expect(out).not.toContain('SUBSCRIPTION_REQUIRED')
  })

  it('explains an unpaid Free-plan event', () => {
    const out = friendlyActivationError('PREPAY_REQUIRED: Pay for this event before activating it.')
    expect(out).toContain('not been paid for')
    expect(out).not.toContain('PREPAY_REQUIRED')
  })

  it('pulls the real limit out of the monthly-event error and says when it resets', () => {
    const out = friendlyActivationError(
      'EVENT_LIMIT_REACHED: Your plan allows 1 event(s) per month. Upgrade to run more.',
    )
    expect(out).toContain('all 1 of your events this month')
    // The organiser needs to know when they can next run one, not just that they can't.
    expect(out).toContain('can be activated from')
    expect(out).not.toContain('EVENT_LIMIT_REACHED')
  })

  it('pulls the real limit out of the team error', () => {
    const out = friendlyActivationError(
      'TEAM_LIMIT_EXCEEDED: Your plan allows 20 teams/players per event. Upgrade for more.',
    )
    expect(out).toContain('(20 per event)')
    expect(out).not.toContain('TEAM_LIMIT_EXCEEDED')
  })

  it('explains suspension', () => {
    const out = friendlyActivationError(
      'ORG_SUSPENDED: This organization is suspended and cannot activate events.',
    )
    expect(out).toContain('suspended')
    expect(out).not.toContain('ORG_SUSPENDED')
  })

  it('passes an unrecognised error through rather than swallowing it', () => {
    expect(friendlyActivationError('some unexpected db failure')).toBe('some unexpected db failure')
    expect(friendlyActivationError(null)).toBe('Could not activate this event.')
  })
})
