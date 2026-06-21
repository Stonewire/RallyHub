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

import { type PlanId } from '@/lib/subscription-plans'

export type ClientPlanValue = PlanId
