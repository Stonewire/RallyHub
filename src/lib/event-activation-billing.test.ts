import { describe, expect, it } from 'vitest'

import { friendlyActivationError } from './event-activation-billing'

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

  it('pulls the real limit out of the monthly-event error', () => {
    const out = friendlyActivationError(
      'EVENT_LIMIT_REACHED: Your plan allows 10 event(s) per month. Upgrade to run more.',
    )
    expect(out).toContain('all 10 of your events this month')
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
