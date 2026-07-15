import { describe, expect, it } from 'vitest'

import {
  formatDualMonthlyPriceLine,
  getPlan,
  planPriceDisplay,
} from './subscription-plans'

// These limits are enforced server-side by plan_monthly_event_limit() /
// plan_team_limit() in migration 20260714120000_pay1_entitlement_gate.sql.
// If these values change here, change the SQL functions too, or the gate and
// the pricing display will disagree.
describe('plan limits (mirror of the SQL entitlement gate)', () => {
  it.each([
    ['rookie', 1, 10],
    ['arena', 10, 20],
    ['pro', 20, 30],
    ['max', 40, 50],
  ])('%s allows %i events/month and %i teams/event', (plan, events, teams) => {
    expect(getPlan(plan).monthlyEventLimit).toBe(events)
    expect(getPlan(plan).teamLimit).toBe(teams)
  })

  it.each(['enterprise', 'partner'])('%s is unlimited', (plan) => {
    expect(getPlan(plan).monthlyEventLimit).toBeNull()
    expect(getPlan(plan).teamLimit).toBeNull()
  })
})

describe('planPriceDisplay', () => {
  it('frames a paid plan per month: yearly-equivalent headline, one charge/year, monthly option', () => {
    // Starter: €180/yr (=€15/mo) or €20/mo monthly.
    const d = planPriceDisplay(getPlan('arena'))
    expect(d.headline).toBe('€15/mo')
    expect(d.yearlyNote).toBe('billed yearly · €180 once a year')
    expect(d.monthlyNote).toBe('or €20/mo billed monthly')
  })

  it('prices Pro as the best-value standard tier and Business above it', () => {
    const pro = getPlan('pro')
    const business = getPlan('max')
    expect(pro.monthlyPriceEur).toBe(70)
    expect(pro.yearlyPriceEur).toBe(660)
    expect(pro.perEventPriceEur).toBe(99)
    expect(business.monthlyPriceEur).toBe(150)
    expect(business.yearlyPriceEur).toBe(1440)
    expect(business.perEventPriceEur).toBe(95)
    expect(planPriceDisplay(business).headline).toBe('€120/mo')
  })

  it('shows Free plan as €0 with no monthly note', () => {
    const d = planPriceDisplay(getPlan('rookie'))
    expect(d.headline).toBe('€0')
    expect(d.monthlyNote).toBeNull()
  })

  it('shows Enterprise as price on request', () => {
    const d = planPriceDisplay(getPlan('enterprise'))
    expect(d.headline).toBe('Custom')
    expect(d.yearlyNote).toBe('Price on request')
    expect(d.monthlyNote).toBeNull()
  })
})

describe('approved plan ladder', () => {
  const monthlyTotal = (planId: 'arena' | 'pro' | 'max', events: number) => {
    const plan = getPlan(planId)
    return plan.monthlyPriceEur + plan.perEventPriceEur * events
  }

  it('makes Starter and Pro equal for one event, then Pro the better standard deal', () => {
    expect(monthlyTotal('arena', 1)).toBe(169)
    expect(monthlyTotal('pro', 1)).toBe(169)
    expect(monthlyTotal('pro', 2)).toBeLessThan(monthlyTotal('arena', 2))
  })

  it('keeps Pro best through its 20-event capacity and crosses Business there', () => {
    expect(monthlyTotal('pro', 10)).toBeLessThan(monthlyTotal('max', 10))
    expect(monthlyTotal('pro', 20)).toBe(2050)
    expect(monthlyTotal('max', 20)).toBe(2050)
  })
})

describe('formatDualMonthlyPriceLine', () => {
  it('combines both per-month prices on one line for paid plans', () => {
    expect(formatDualMonthlyPriceLine(getPlan('arena'))).toBe('€15/mo yearly or €20/mo monthly')
  })

  it('returns Free for the free plan and Price on request for enterprise', () => {
    expect(formatDualMonthlyPriceLine(getPlan('rookie'))).toBe('Free')
    expect(formatDualMonthlyPriceLine(getPlan('enterprise'))).toBe('Price on request')
  })
})
