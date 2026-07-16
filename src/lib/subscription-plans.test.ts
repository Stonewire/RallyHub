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
    ['rookie', null, 5],
    ['arena', 2, 5],
    ['pro', null, 5],
  ])('%s has %s events/month and %i teams/event', (plan, events, teams) => {
    expect(getPlan(plan).monthlyEventLimit).toBe(events)
    expect(getPlan(plan).teamLimit).toBe(teams)
  })

  it.each(['enterprise', 'partner'])('%s has custom/unlimited limits', (plan) => {
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

  it('uses the final Pro subscription prices', () => {
    const pro = getPlan('pro')
    expect(pro.monthlyPriceEur).toBe(200)
    expect(pro.yearlyPriceEur).toBe(1800)
    expect(pro.perEventPriceEur).toBe(99)
    expect(planPriceDisplay(pro).headline).toBe('€150/mo')
  })

  it('shows Pay Per Event with no subscription', () => {
    const d = planPriceDisplay(getPlan('rookie'))
    expect(d.headline).toBe('€199/event')
    expect(d.yearlyNote).toBe('No subscription')
    expect(d.monthlyNote).toBeNull()
  })

  it('shows Custom as price on request', () => {
    const d = planPriceDisplay(getPlan('enterprise'))
    expect(d.headline).toBe('Custom')
    expect(d.yearlyNote).toBe('Price on request')
    expect(d.monthlyNote).toBeNull()
  })
})

describe('approved plan ladder', () => {
  const monthlyTotal = (planId: 'arena' | 'pro', events: number) => {
    const plan = getPlan(planId)
    return plan.monthlyPriceEur + plan.perEventPriceEur * events
  }

  it('keeps Starter cheaper within its two-event allowance', () => {
    expect(monthlyTotal('arena', 1)).toBe(169)
    expect(monthlyTotal('arena', 2)).toBe(318)
    expect(monthlyTotal('pro', 2)).toBe(398)
  })
})

describe('formatDualMonthlyPriceLine', () => {
  it('combines both per-month prices on one line for paid plans', () => {
    expect(formatDualMonthlyPriceLine(getPlan('arena'))).toBe('€15/mo yearly or €20/mo monthly')
  })

  it('returns no subscription for Pay Per Event and Price on request for Custom', () => {
    expect(formatDualMonthlyPriceLine(getPlan('rookie'))).toBe('No subscription')
    expect(formatDualMonthlyPriceLine(getPlan('enterprise'))).toBe('Price on request')
  })
})
