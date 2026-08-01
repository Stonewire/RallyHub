/**
 * Country list for the Organisation billing address.
 *
 * Stored as the country NAME rather than an ISO code, because that is what the
 * column already holds for existing organisations and what the invoice export
 * prints. Switching to codes would need a data migration for no visible gain.
 *
 * EU members are listed because VAT handling cares about them, followed by the
 * remaining markets RallyHub sells into. Any value already saved that is not on
 * this list is preserved and shown, so no organisation silently loses its
 * country when this list changes.
 */
export const COUNTRIES = [
  'Austria',
  'Belgium',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czechia',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Ireland',
  'Italy',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Netherlands',
  'Poland',
  'Portugal',
  'Romania',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
  'Australia',
  'Canada',
  'Iceland',
  'Liechtenstein',
  'New Zealand',
  'Norway',
  'Serbia',
  'Switzerland',
  'Türkiye',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
] as const

/**
 * The list to render, with any previously saved value that is not a known
 * country appended so an existing address is never silently blanked.
 */
export function countryOptions(current: string): readonly string[] {
  const trimmed = current.trim()
  if (!trimmed || (COUNTRIES as readonly string[]).includes(trimmed)) {
    return COUNTRIES
  }
  return [trimmed, ...COUNTRIES]
}

/**
 * Postcode format per country, for the address form.
 *
 * Format only. A string can match the pattern and still not be a real postcode;
 * proving that needs a postal address API, which is a separate piece of work.
 * The point here is to catch the common mistakes, a UK code typed into a German
 * address or a digit missing, before an invoice is raised against it.
 *
 * Countries absent from this map accept anything, which is deliberate: a
 * pattern we are unsure of would reject valid addresses, and that is worse than
 * accepting a typo. Ireland is intentionally absent below in spirit (Eircodes
 * are irregular) but included with its documented routing-key format.
 */
const POSTCODE_RULES: Record<string, { pattern: RegExp; example: string }> = {
  Austria: { pattern: /^\d{4}$/, example: '1010' },
  Belgium: { pattern: /^\d{4}$/, example: '1000' },
  Bulgaria: { pattern: /^\d{4}$/, example: '1000' },
  Croatia: { pattern: /^\d{5}$/, example: '10000' },
  Cyprus: { pattern: /^\d{4}$/, example: '1010' },
  Czechia: { pattern: /^\d{3} ?\d{2}$/, example: '110 00' },
  Denmark: { pattern: /^\d{4}$/, example: '1050' },
  Estonia: { pattern: /^\d{5}$/, example: '10111' },
  Finland: { pattern: /^\d{5}$/, example: '00100' },
  France: { pattern: /^\d{5}$/, example: '75001' },
  Germany: { pattern: /^\d{5}$/, example: '10115' },
  Greece: { pattern: /^\d{3} ?\d{2}$/, example: '104 31' },
  Hungary: { pattern: /^\d{4}$/, example: '1051' },
  Ireland: { pattern: /^[A-Za-z]\d{2} ?[A-Za-z0-9]{4}$/, example: 'D02 AF30' },
  Italy: { pattern: /^\d{5}$/, example: '00184' },
  Latvia: { pattern: /^(LV-)?\d{4}$/, example: 'LV-1050' },
  Lithuania: { pattern: /^(LT-)?\d{5}$/, example: 'LT-01100' },
  Luxembourg: { pattern: /^(L-)?\d{4}$/, example: 'L-1111' },
  Malta: { pattern: /^[A-Za-z]{3} ?\d{4}$/, example: 'VLT 1234' },
  Netherlands: { pattern: /^\d{4} ?[A-Za-z]{2}$/, example: '1012 AB' },
  Poland: { pattern: /^\d{2}-?\d{3}$/, example: '00-001' },
  Portugal: { pattern: /^\d{4}-?\d{3}$/, example: '1100-048' },
  Romania: { pattern: /^\d{6}$/, example: '010011' },
  Slovakia: { pattern: /^\d{3} ?\d{2}$/, example: '811 01' },
  Slovenia: { pattern: /^(SI-)?\d{4}$/, example: '1000' },
  Spain: { pattern: /^\d{5}$/, example: '28001' },
  Sweden: { pattern: /^\d{3} ?\d{2}$/, example: '111 29' },
  Australia: { pattern: /^\d{4}$/, example: '2000' },
  Canada: { pattern: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, example: 'K1A 0B1' },
  Iceland: { pattern: /^\d{3}$/, example: '101' },
  Liechtenstein: { pattern: /^\d{4}$/, example: '9490' },
  'New Zealand': { pattern: /^\d{4}$/, example: '6011' },
  Norway: { pattern: /^\d{4}$/, example: '0150' },
  Serbia: { pattern: /^\d{5}$/, example: '11000' },
  Switzerland: { pattern: /^\d{4}$/, example: '8001' },
  Türkiye: { pattern: /^\d{5}$/, example: '34000' },
  Ukraine: { pattern: /^\d{5}$/, example: '01001' },
  'United Arab Emirates': { pattern: /^.*$/, example: '' },
  'United Kingdom': {
    pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
    example: 'SW1A 1AA',
  },
  'United States': { pattern: /^\d{5}(-\d{4})?$/, example: '10001' },
}

/** Sample postcode for the chosen country, for use as a placeholder. */
export function postcodeExample(country: string): string {
  return POSTCODE_RULES[country.trim()]?.example ?? ''
}

/**
 * Returns an error message when the postcode cannot be valid for the country,
 * or null when it passes (or when we have no rule, or either field is empty).
 */
export function validatePostcode(country: string, postcode: string): string | null {
  const value = postcode.trim()
  const rule = POSTCODE_RULES[country.trim()]
  if (!value || !rule || !rule.example) return null
  return rule.pattern.test(value)
    ? null
    : `That does not look like a ${country.trim()} postcode. Example: ${rule.example}`
}
