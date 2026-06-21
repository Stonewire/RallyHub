// Educational (school) discount helpers. A school self-marks at signup
// ('pending'); a super-admin confirms ('approved') to unlock 50% off both
// subscriptions and per-event fees. The authoritative per-event discount is
// applied server-side in create_event_activation_invoice (migration 059); these
// helpers drive the matching client-side display.

export const EDUCATIONAL_DISCOUNT_PCT = 50

export type EducationalStatus = 'none' | 'pending' | 'approved'

export function normalizeEducationalStatus(value: string | null | undefined): EducationalStatus {
  if (value === 'pending' || value === 'approved') return value
  return 'none'
}

/** Discount is live only once a super-admin has approved the school. */
export function isEducationalApproved(status: string | null | undefined): boolean {
  return normalizeEducationalStatus(status) === 'approved'
}

/** Halve a euro amount for approved educational orgs (rounded to whole euros). */
export function applyEducationalDiscount(
  amountEur: number,
  status: string | null | undefined,
): number {
  if (!isEducationalApproved(status)) return amountEur
  return Math.round(amountEur / 2)
}

export function educationalStatusLabel(status: string | null | undefined): string {
  switch (normalizeEducationalStatus(status)) {
    case 'approved':
      return 'Educational (50% off)'
    case 'pending':
      return 'Educational — pending review'
    default:
      return 'Not educational'
  }
}
