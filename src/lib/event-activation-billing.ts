import {
  formatEur,
  formatPlanLabel,
  getPlan,
  normalizePlanId,
  type PlanId,
} from '@/lib/subscription-plans'

export type EventActivationWarning = {
  planId: PlanId
  billAmountEur: number
  isComped: boolean
  title: string
  message: string
  confirmLabel: string
}

export function getEventActivationWarning(
  billingPlan: string | null | undefined,
  /** Best active event promo-code discount for this org (0–100). Applied server-side. */
  eventPromoDiscountPercent = 0,
  /** Approved-educational orgs get 50% off, stacked after the promo (server-side). */
  educationalApproved = false,
): EventActivationWarning {
  const planId = normalizePlanId(billingPlan)
  const plan = getPlan(planId)
  const baseAmount = plan.perEventPriceEur

  if (planId === 'partner') {
    return {
      planId,
      billAmountEur: 0,
      isComped: true,
      title: 'Activate event',
      message:
        `Activating this event will record it in your billing history on the ${formatPlanLabel(planId)} plan. ` +
        'Your Partner plan includes events at no cost (100% discount). ' +
        'If you have not started the event yet, keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate at no cost',
    }
  }

  const discountPct = Math.min(100, Math.max(0, Math.round(eventPromoDiscountPercent)))
  const afterPromo = Math.max(baseAmount - Math.round((baseAmount * discountPct) / 100), 0)
  // Educational 50% stacks on top of the promo discount (matches migration 059).
  const billAmountEur = educationalApproved ? Math.round(afterPromo / 2) : afterPromo

  if (billAmountEur === 0) {
    return {
      planId,
      billAmountEur: 0,
      isComped: true,
      title: 'Activate event',
      message:
        `A promo code makes this event free (${discountPct}% off the ${formatEur(baseAmount)} ${formatPlanLabel(planId)} per-event price). ` +
        'Activating records a €0 invoice. If you have not started the event yet, keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate at no cost',
    }
  }

  const priceLabel = formatEur(billAmountEur)
  const promoNote =
    discountPct > 0
      ? ` A promo code applies ${discountPct}% off (was ${formatEur(baseAmount)}).`
      : ''

  return {
    planId,
    billAmountEur,
    isComped: false,
    title: 'Activate event — billing confirmation',
    message:
      `Activating this event will generate a bill of ${priceLabel} based on your ${formatPlanLabel(planId)} plan.${promoNote} ` +
      'If you have not started the event yet, keep it at Ready status to avoid being billed. ' +
      'Once activated, an event cannot be run again — duplicate it to schedule another session.',
    confirmLabel: `Activate and bill ${priceLabel}`,
  }
}

export function isActivationBillingRequired(
  currentStatus: string,
  nextStatus: string,
  invoicedAt?: string | null,
): boolean {
  if (invoicedAt) return false
  return nextStatus === 'active' && currentStatus !== 'active'
}
