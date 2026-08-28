import { describe, expect, it } from 'vitest'

import {
  formatLimitResetDate,
  friendlyActivationError,
  getEventActivationWarning,
} from './event-activation-billing'

describe('getEventActivationWarning', () => {
  it('charges the normal per-event price even when no previous invoice exists', () => {
    const warning = getEventActivationWarning('arena')
    expect(warning.billAmountEur).toBe(149)
    expect(warning.isComped).toBe(false)
    expect(warning.message).not.toContain('first event')
  })

  it('still allows a selected client to receive a free event through a 100% promo', () => {
    const warning = getEventActivationWarning('pro', 100)
    expect(warning.billAmountEur).toBe(0)
    expect(warning.isComped).toBe(true)
    expect(warning.message).toContain('promo code makes this event free')
  })

  it('adds €10 for every team above the five included teams', () => {
    const warning = getEventActivationWarning('arena', 0, false, 8)
    expect(warning.extraTeamCount).toBe(3)
    expect(warning.extraTeamChargeEur).toBe(30)
    expect(warning.billAmountEur).toBe(179)
    expect(warning.message).toContain('€30 for 3 additional teams at €10 each')
  })

  it('does not discount purchased team capacity with an event promo', () => {
    const warning = getEventActivationWarning('pro', 100, false, 7)
    expect(warning.billAmountEur).toBe(20)
    expect(warning.isComped).toBe(false)
    expect(warning.confirmLabel).toBe('Activate and bill €20')
  })

  it('shows exact cents for an educational discount', () => {
    const warning = getEventActivationWarning('arena', 0, true, 5)
    expect(warning.billAmountEur).toBe(74.5)
    expect(warning.confirmLabel).toBe('Activate and bill €74.50')
  })

  // P6.2: custom subscriptions. NULL always means "follow the plan price".
  it('leaves the plan price untouched when no custom per-event price is set', () => {
    const warning = getEventActivationWarning('arena', 0, false, 5, null)
    expect(warning.billAmountEur).toBe(149)
  })

  it('uses the custom per-event price as the base amount', () => {
    const warning = getEventActivationWarning('arena', 0, false, 8, 50)
    expect(warning.billAmountEur).toBe(80)
    expect(warning.extraTeamChargeEur).toBe(30)
    expect(warning.isComped).toBe(false)
  })

  it('comps the event when events are included (custom price 0) and no extra teams', () => {
    const warning = getEventActivationWarning('pro', 0, false, 5, 0)
    expect(warning.billAmountEur).toBe(0)
    expect(warning.isComped).toBe(true)
    expect(warning.message).toContain('included in your custom subscription')
  })

  it('still charges additional teams when events are included', () => {
    const warning = getEventActivationWarning('pro', 0, false, 8, 0)
    expect(warning.billAmountEur).toBe(30)
    expect(warning.isComped).toBe(false)
    expect(warning.message).toContain('event fee itself is included')
  })

  it('applies promo and educational discounts to a custom per-event price, like the invoice', () => {
    const warning = getEventActivationWarning('arena', 50, true, 5, 100)
    // 100 → 50 after promo → 25 after educational.
    expect(warning.billAmountEur).toBe(25)
  })

  it('keeps partner fully comped even with a custom per-event price', () => {
    const warning = getEventActivationWarning('partner', 0, false, 8, 50)
    expect(warning.billAmountEur).toBe(0)
    expect(warning.isComped).toBe(true)
  })

  // P6.3: open joining. The team count is unknown at activation, so the
  // surcharge never lands on the activation bill; it settles at event end.
  it('charges no team surcharge at activation for an open-joining event', () => {
    const warning = getEventActivationWarning('arena', 0, false, 12, null, true)
    expect(warning.billAmountEur).toBe(149)
    expect(warning.extraTeamCount).toBe(0)
    expect(warning.extraTeamChargeEur).toBe(0)
    expect(warning.message).toContain('when it ends')
  })

  it('keeps the settle-at-end note when a promo makes an open-joining event free', () => {
    const warning = getEventActivationWarning('pro', 100, false, 5, null, true)
    expect(warning.billAmountEur).toBe(0)
    expect(warning.isComped).toBe(true)
    expect(warning.message).toContain('when it ends')
  })

  it('leaves normal events untouched when openJoining is false', () => {
    const withFlag = getEventActivationWarning('arena', 0, false, 8, null, false)
    const withoutFlag = getEventActivationWarning('arena', 0, false, 8)
    expect(withFlag).toEqual(withoutFlag)
    expect(withFlag.billAmountEur).toBe(179)
  })
})

describe('formatLimitResetDate', () => {
  it('returns the 1st of next month', () => {
    expect(formatLimitResetDate(new Date('2026-07-14T10:00:00Z'))).toBe('1 August 2026')
  })

  it('rolls over the year from December', () => {
    expect(formatLimitResetDate(new Date('2026-12-20T10:00:00Z'))).toBe('1 January 2027')
  })
})

// The raw strings below are exactly what assert_event_activation_allowed raises.
// If the SQL messages change, these break — which is the point.
describe('friendlyActivationError', () => {
  it('explains a missing/lapsed subscription', () => {
    const out = friendlyActivationError(
      'SUBSCRIPTION_REQUIRED: Start a subscription (paid for the current period) before activating events.',
    )
    expect(out).toContain('subscription is not active')
    expect(out).not.toContain('SUBSCRIPTION_REQUIRED')
  })

  it('explains an outstanding invoice blocking the next Free-plan event', () => {
    const out = friendlyActivationError(
      'UNPAID_INVOICE: Settle your outstanding event invoice before activating another event.',
    )
    expect(out).toContain('unpaid event invoice')
    expect(out).not.toContain('UNPAID_INVOICE')
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
