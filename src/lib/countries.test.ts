import { describe, expect, it } from 'vitest'

import { postcodeExample, validatePostcode } from '@/lib/countries'

describe('validatePostcode', () => {
  it('accepts a correct postcode for the country', () => {
    expect(validatePostcode('Malta', 'VLT 1234')).toBeNull()
    expect(validatePostcode('United Kingdom', 'SW1A 1AA')).toBeNull()
    expect(validatePostcode('Germany', '10115')).toBeNull()
  })

  it('accepts the documented example for every country that has a rule', () => {
    for (const country of ['France', 'Netherlands', 'Canada', 'Poland', 'Ireland']) {
      expect(validatePostcode(country, postcodeExample(country))).toBeNull()
    }
  })

  it('rejects a postcode from the wrong country', () => {
    // The exact mistake this exists to catch.
    expect(validatePostcode('Germany', 'SW1A 1AA')).toMatch(/Germany postcode/)
    expect(validatePostcode('Malta', '10115')).toMatch(/Malta postcode/)
  })

  it('is lenient where it has no rule or nothing to check', () => {
    expect(validatePostcode('Atlantis', 'ABC')).toBeNull()
    expect(validatePostcode('Germany', '')).toBeNull()
    expect(validatePostcode('', '10115')).toBeNull()
  })

  it('tolerates the optional separators people actually type', () => {
    expect(validatePostcode('Poland', '00001')).toBeNull()
    expect(validatePostcode('Poland', '00-001')).toBeNull()
    expect(validatePostcode('Netherlands', '1012AB')).toBeNull()
  })
})
