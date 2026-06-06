export type BillingPeriod = 'monthly' | 'yearly'

export type PlanId = 'free' | 'starter' | 'pro' | 'partner'

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
  free: {
    id: 'free',
    name: 'Free',
    monthlyPriceEur: 0,
    yearlyPriceEur: 0,
    perEventPriceEur: 150,
    monthlyEventLimit: 1,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPriceEur: 20,
    yearlyPriceEur: 200,
    perEventPriceEur: 100,
    monthlyEventLimit: null,
    billingPeriods: ['monthly', 'yearly'],
    hidden: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceEur: 50,
    yearlyPriceEur: 500,
    perEventPriceEur: 50,
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

const LEGACY_PLAN_ALIASES: Record<string, PlanId> = {
  enterprise: 'partner',
}

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const key = plan?.toLowerCase().trim()
  if (!key) return 'free'
  if (key in SUBSCRIPTION_PLANS) return key as PlanId
  return LEGACY_PLAN_ALIASES[key] ?? 'free'
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
