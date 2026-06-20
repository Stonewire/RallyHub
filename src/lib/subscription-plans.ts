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
}

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  rookie: {
    id: 'rookie',
    name: 'Rookie',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 150,
    monthlyEventLimit: null,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
  },
  arena: {
    id: 'arena',
    name: 'Arena',
    monthlyPriceEur: 10,
    yearlyPriceEur: 100,
    perEventPriceEur: 100,
    monthlyEventLimit: null,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceEur: 30,
    yearlyPriceEur: 300,
    perEventPriceEur: 50,
    monthlyEventLimit: null,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
  },
  max: {
    id: 'max',
    name: 'Max',
    monthlyPriceEur: 50,
    yearlyPriceEur: 500,
    perEventPriceEur: 25,
    monthlyEventLimit: null,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
  },
  partner: {
    id: 'partner',
    name: 'Partner',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 0,
    monthlyEventLimit: null,
    billingPeriods: ['monthly', 'yearly'],
    hidden: true,
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
  return period === 'yearly' ? 'yearly' : 'monthly'
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
