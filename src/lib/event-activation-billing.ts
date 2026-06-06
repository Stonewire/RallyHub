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
): EventActivationWarning {
  const planId = normalizePlanId(billingPlan)
  const plan = getPlan(planId)
  const billAmountEur = plan.perEventPriceEur
  const isComped = planId === 'partner'

  if (isComped) {
    return {
      planId,
      billAmountEur,
      isComped: true,
      title: 'Activate event',
      message:
        `Activating this event will record it in your billing history on the ${formatPlanLabel(planId)} plan. ` +
        'Your Partner plan includes events at no cost (100% discount). ' +
        'If you have not started the event yet, keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate at no cost',
    }
  }

  const priceLabel = formatEur(billAmountEur)

  return {
    planId,
    billAmountEur,
    isComped: false,
    title: 'Activate event — billing confirmation',
    message:
      `Activating this event will generate a bill of ${priceLabel} based on your ${formatPlanLabel(planId)} plan (${priceLabel} per event). ` +
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
