export type BillingPeriod = 'monthly' | 'yearly'

export type PlanId = 'rookie' | 'arena' | 'pro' | 'max' | 'partner'

export type SubscriptionPlan = {
  id: PlanId
  name: string
  monthlyPriceEur: number
  yearlyPriceEur: number
  perEventPriceEur: number
  /** Max events per calendar month, or null for unlimited. */
  monthlyEventLimit: number | null
  billingPeriods: BillingPeriod[]
  /** Hidden plans are omitted from client-facing plan lists. */
  hidden: boolean
  /** True when the plan has no recurring subscription (pay-per-event only). */
  freeSubscription: boolean
  /** Completely custom branding across the app + visual deliverables (Max only). */
  customBranding: boolean
}

// NOTE: Internal IDs stay 'rookie'/'arena' to avoid a DB migration — existing
// orgs store these values. Display names are 'Free'/'Starter' (see name below);
// LEGACY_PLAN_ALIASES also maps free→rookie and starter→arena. All paid plans are
// billed YEARLY only (no monthly billing); a monthly-equivalent price may be
// shown for marketing via formatMonthlyEquivalentPrice().
export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  rookie: {
    id: 'rookie',
    name: 'Free',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 150,
    monthlyEventLimit: 1,
    billingPeriods: ['yearly'],
    hidden: false,
    freeSubscription: true,
    customBranding: false,
  },
  arena: {
    id: 'arena',
    name: 'Starter',
    monthlyPriceEur: 0,
    yearlyPriceEur: 100,
    perEventPriceEur: 150,
    monthlyEventLimit: null,
    billingPeriods: ['yearly'],
    hidden: false,
    freeSubscription: false,
    customBranding: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceEur: 0,
    yearlyPriceEur: 300,
    perEventPriceEur: 100,
    monthlyEventLimit: null,
    billingPeriods: ['yearly'],
    hidden: false,
    freeSubscription: false,
    customBranding: false,
  },
  max: {
    id: 'max',
    name: 'Max',
    monthlyPriceEur: 0,
    yearlyPriceEur: 500,
    perEventPriceEur: 50,
    monthlyEventLimit: null,
    billingPeriods: ['yearly'],
    hidden: false,
    freeSubscription: false,
    customBranding: true,
  },
  partner: {
    id: 'partner',
    name: 'Partner',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 0,
    monthlyEventLimit: null,
    billingPeriods: ['yearly'],
    hidden: true,
    freeSubscription: true,
    customBranding: true,
  },
}

export const PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS) as PlanId[]

export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'yearly']

/**
 * Maps old plan IDs (from before the Rookie/Arena/Pro/Max rename) to new IDs.
 * Allows existing DB values to keep working without a migration.
 */
const LEGACY_PLAN_ALIASES: Record<string, PlanId> = {
  free: 'rookie',
  starter: 'arena',
  // old 'pro' (€500/yr) maps to 'max'; the new 'pro' is €300/yr
  enterprise: 'partner',
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
  // Monthly billing is retired — everything is billed yearly.
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
  if (plan.perEventPriceEur === 0) return 'No per-event fee'
  return `${formatEur(plan.perEventPriceEur)} per event`
}

export function formatBillingPeriodLabel(period: BillingPeriod): string {
  return period === 'yearly' ? 'Yearly' : 'Monthly'
}

/**
 * Marketing display only: the monthly-equivalent of the yearly price (billed
 * yearly). Returns e.g. "€8/mo" for a €100/year plan. Free plans return "€0".
 */
export function formatMonthlyEquivalentPrice(plan: SubscriptionPlan): string {
  if (plan.yearlyPriceEur === 0) return '€0'
  return `${formatEur(Math.round(plan.yearlyPriceEur / 12))}/mo`
}

/** Yearly price string, e.g. "€100/year". Free plans return "Free". */
export function formatYearlyPrice(plan: SubscriptionPlan): string {
  if (plan.yearlyPriceEur === 0) return 'Free'
  return `${formatEur(plan.yearlyPriceEur)}/year`
}
