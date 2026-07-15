export type BillingPeriod = 'monthly' | 'yearly'

export type PlanId = 'rookie' | 'arena' | 'pro' | 'max' | 'enterprise' | 'partner'

/** How much RallyHub branding a plan removes from the product/deliverables. */
export type BrandingRemoval = 'none' | 'partial' | 'full'

export type SubscriptionPlan = {
  id: PlanId
  name: string
  monthlyPriceEur: number
  yearlyPriceEur: number
  perEventPriceEur: number
  /** Max events per calendar month, or null for unlimited. */
  monthlyEventLimit: number | null
  /** Max teams/players per event, or null for unlimited. */
  teamLimit: number | null
  billingPeriods: BillingPeriod[]
  /** Hidden plans are omitted from client-facing plan lists. */
  hidden: boolean
  /** True when the plan has no recurring subscription (pay-per-event only). */
  freeSubscription: boolean
  /** True when pricing is negotiated directly rather than shown/self-serve (Enterprise). */
  priceOnRequest: boolean
  brandingRemoval: BrandingRemoval
}

// NOTE: Internal IDs stay 'rookie'/'arena'/'max' to avoid a DB migration — existing
// orgs store these values. Display names are 'Free'/'Starter'/'Business' (see name
// below); LEGACY_PLAN_ALIASES also maps free→rookie and starter→arena.
//
// 'enterprise' is a new visible, contact-sales-only tier: self-serve registration
// (RegisterPage + register-client Edge Function's ALLOWED_PLANS) never offers it —
// it is only assigned by a super admin. The create_event_activation_invoice DB
// function already treats an org on 'enterprise' like Partner (fully comped);
// Enterprise billing is arranged directly with the client, outside per-event
// invoicing.
export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  rookie: {
    id: 'rookie',
    name: 'Free',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 199,
    monthlyEventLimit: 1,
    teamLimit: 10,
    billingPeriods: ['yearly'],
    hidden: false,
    freeSubscription: true,
    priceOnRequest: false,
    brandingRemoval: 'none',
  },
  arena: {
    id: 'arena',
    name: 'Starter',
    monthlyPriceEur: 20,
    yearlyPriceEur: 180,
    perEventPriceEur: 149,
    monthlyEventLimit: 10,
    teamLimit: 20,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
    freeSubscription: false,
    priceOnRequest: false,
    brandingRemoval: 'none',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceEur: 70,
    yearlyPriceEur: 660,
    perEventPriceEur: 99,
    monthlyEventLimit: 20,
    teamLimit: 30,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
    freeSubscription: false,
    priceOnRequest: false,
    brandingRemoval: 'none',
  },
  max: {
    id: 'max',
    name: 'Business',
    monthlyPriceEur: 150,
    yearlyPriceEur: 1440,
    perEventPriceEur: 95,
    monthlyEventLimit: 40,
    teamLimit: 50,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
    freeSubscription: false,
    priceOnRequest: false,
    brandingRemoval: 'partial',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 0,
    monthlyEventLimit: null,
    teamLimit: null,
    billingPeriods: ['yearly'],
    hidden: false,
    freeSubscription: false,
    priceOnRequest: true,
    brandingRemoval: 'full',
  },
  partner: {
    id: 'partner',
    name: 'Partner',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 0,
    monthlyEventLimit: null,
    teamLimit: null,
    billingPeriods: ['yearly'],
    hidden: true,
    freeSubscription: true,
    priceOnRequest: false,
    brandingRemoval: 'full',
  },
}

export const PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS) as PlanId[]

export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'yearly']

/** Shown near any customer-facing price/plan display. VAT is not charged yet. */
export const VAT_DISCLAIMER = 'All prices exclude VAT.'

/**
 * Maps old plan IDs (from before the Rookie/Arena/Pro/Max rename) to new IDs.
 * Allows existing DB values to keep working without a migration.
 */
const LEGACY_PLAN_ALIASES: Record<string, PlanId> = {
  free: 'rookie',
  starter: 'arena',
}

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const key = plan?.toLowerCase().trim()
  if (!key) return 'rookie'
  if (key in SUBSCRIPTION_PLANS) return key as PlanId
  return LEGACY_PLAN_ALIASES[key] ?? 'rookie'
}

export function normalizeBillingPeriod(
  period: string | null | undefined,
): BillingPeriod {
  return period === 'monthly' ? 'monthly' : 'yearly'
}

export function getPlan(plan: string | null | undefined): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[normalizePlanId(plan)]
}

export function getVisiblePlans(): SubscriptionPlan[] {
  return PLAN_IDS.map((id) => SUBSCRIPTION_PLANS[id]).filter((p) => !p.hidden)
}

/** All plans, including hidden Partner — for super-admin assignment only. */
export function getAdminAssignablePlans(): SubscriptionPlan[] {
  return PLAN_IDS.map((id) => SUBSCRIPTION_PLANS[id])
}

/** Paid, visible plans only (excludes the Free plan) — marketing plan grid. */
export function getPaidPlans(): SubscriptionPlan[] {
  return getVisiblePlans().filter((p) => !p.freeSubscription)
}

/**
 * Visible plans a visitor can actually self-serve register into. Excludes
 * price-on-request plans (Enterprise) — those are contact-sales only and are
 * assigned by a super admin, never chosen at signup.
 */
export function getSelfServePlans(): SubscriptionPlan[] {
  return getVisiblePlans().filter((p) => !p.priceOnRequest)
}

export function formatPlanLabel(plan: string | null | undefined): string {
  return getPlan(plan).name
}

export function formatEur(amount: number): string {
  if (amount === 0) return '€0'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatSubscriptionPrice(
  plan: SubscriptionPlan,
  period: BillingPeriod,
): string {
  if (plan.priceOnRequest) return 'Price on request'
  const amount =
    period === 'yearly' ? plan.yearlyPriceEur : plan.monthlyPriceEur
  if (amount === 0) return '€0'
  return period === 'yearly'
    ? `${formatEur(amount)}/year`
    : `${formatEur(amount)}/month`
}

export function formatEventLimit(plan: SubscriptionPlan): string {
  if (plan.monthlyEventLimit === null) return 'Unlimited events'
  if (plan.monthlyEventLimit === 1) return '1 event per month'
  return `${plan.monthlyEventLimit} events per month`
}

export function formatPerEventPrice(plan: SubscriptionPlan): string {
  if (plan.priceOnRequest) return 'Custom per-event pricing'
  if (plan.perEventPriceEur === 0) return 'No per-event fee'
  return `${formatEur(plan.perEventPriceEur)} per event`
}

/** Teams/players allowed per event on this plan, or unlimited. */
export function formatTeamLimit(plan: SubscriptionPlan): string {
  if (plan.teamLimit === null) return 'Unlimited teams / players per event'
  return `${plan.teamLimit} teams / players per event`
}

/** Branding-removal feature line for the plan card, or null if the plan has none. */
export function formatBrandingNote(plan: SubscriptionPlan): string | null {
  if (plan.brandingRemoval === 'full') return 'Fully removes RallyHub branding'
  if (plan.brandingRemoval === 'partial') return 'Partially removes RallyHub branding'
  return null
}

export function formatBillingPeriodLabel(period: BillingPeriod): string {
  return period === 'yearly' ? 'Yearly' : 'Monthly'
}

/**
 * Marketing display only: the monthly-equivalent of the yearly price (billed
 * yearly). Returns e.g. "€8/mo" for a €100/year plan. Free plans return "€0".
 */
export function formatMonthlyEquivalentPrice(plan: SubscriptionPlan): string {
  if (plan.priceOnRequest) return 'Custom'
  if (plan.yearlyPriceEur === 0) return '€0'
  return `${formatEur(Math.round(plan.yearlyPriceEur / 12))}/mo`
}

/** Yearly price string, e.g. "€100/year". Free plans return "Free". */
export function formatYearlyPrice(plan: SubscriptionPlan): string {
  if (plan.priceOnRequest) return 'Price on request'
  if (plan.yearlyPriceEur === 0) return 'Free'
  return `${formatEur(plan.yearlyPriceEur)}/year`
}

/**
 * Plan pricing framed always per month, for plan cards and the pricing section.
 * `headline` is the cheaper yearly-prepaid per-month figure; `yearlyNote` spells
 * out that it is one charge a year; `monthlyNote` is the pricier monthly-billed
 * option (null when the plan has no monthly billing). Free → "€0"; Enterprise →
 * "Custom" / "Price on request".
 */
export function planPriceDisplay(plan: SubscriptionPlan): {
  headline: string
  yearlyNote: string | null
  monthlyNote: string | null
} {
  if (plan.priceOnRequest) {
    return { headline: 'Custom', yearlyNote: 'Price on request', monthlyNote: null }
  }
  if (plan.yearlyPriceEur === 0 && plan.monthlyPriceEur === 0) {
    return { headline: '€0', yearlyNote: 'Free forever', monthlyNote: null }
  }
  const hasMonthly = plan.billingPeriods.includes('monthly') && plan.monthlyPriceEur > 0
  return {
    headline: formatMonthlyEquivalentPrice(plan),
    yearlyNote: `billed yearly · ${formatEur(plan.yearlyPriceEur)} once a year`,
    monthlyNote: hasMonthly ? `or ${formatEur(plan.monthlyPriceEur)}/mo billed monthly` : null,
  }
}

/**
 * One-line per-month price for compact contexts (e.g. the signup dropdown),
 * e.g. "€15/mo yearly or €20/mo monthly". Free → "Free"; Enterprise →
 * "Price on request".
 */
export function formatDualMonthlyPriceLine(plan: SubscriptionPlan): string {
  if (plan.priceOnRequest) return 'Price on request'
  if (plan.yearlyPriceEur === 0 && plan.monthlyPriceEur === 0) return 'Free'
  const yearly = `${formatMonthlyEquivalentPrice(plan)} yearly`
  const hasMonthly = plan.billingPeriods.includes('monthly') && plan.monthlyPriceEur > 0
  return hasMonthly ? `${yearly} or ${formatEur(plan.monthlyPriceEur)}/mo monthly` : yearly
}
