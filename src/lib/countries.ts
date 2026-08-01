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
