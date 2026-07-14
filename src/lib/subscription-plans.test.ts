import { describe, expect, it } from 'vitest'

import {
  formatDualMonthlyPriceLine,
  getPlan,
  planPriceDisplay,
} from './subscription-plans'

describe('planPriceDisplay', () => {
  it('frames a paid plan per month: yearly-equivalent headline, one charge/year, monthly option', () => {
    // Starter: €180/yr (=€15/mo) or €20/mo monthly.
    const d = planPriceDisplay(getPlan('arena'))
    expect(d.headline).toBe('€15/mo')
    expect(d.yearlyNote).toBe('billed yearly · €180 once a year')
    expect(d.monthlyNote).toBe('or €20/mo billed monthly')
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

describe('formatDualMonthlyPriceLine', () => {
  it('combines both per-month prices on one line for paid plans', () => {
    expect(formatDualMonthlyPriceLine(getPlan('arena'))).toBe('€15/mo yearly or €20/mo monthly')
  })

  it('returns Free for the free plan and Price on request for enterprise', () => {
    expect(formatDualMonthlyPriceLine(getPlan('rookie'))).toBe('Free')
    expect(formatDualMonthlyPriceLine(getPlan('enterprise'))).toBe('Price on request')
  })
})
