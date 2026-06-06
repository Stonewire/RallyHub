/**
 * @deprecated Import from `@/lib/subscription-plans` instead.
 * Re-exports kept for existing imports.
 */
export {
  type BillingPeriod,
  type PlanId,
  BILLING_PERIODS,
  formatBillingPeriodLabel,
  formatEur,
  formatEventLimit,
  formatPerEventPrice,
  formatPlanLabel as formatClientPlanLabel,
  formatSubscriptionPrice,
  getAdminAssignablePlans,
  getPlan,
  getVisiblePlans,
  normalizeBillingPeriod,
  normalizePlanId as normalizeClientPlan,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
} from '@/lib/subscription-plans'

import { getAdminAssignablePlans, type PlanId } from '@/lib/subscription-plans'

/** Super-admin plan options (includes hidden Partner). */
export const CLIENT_PLAN_OPTIONS = getAdminAssignablePlans().map((plan) => ({
  value: plan.id,
  label: plan.name,
})) as { value: PlanId; label: string }[]

export type ClientPlanValue = PlanId
