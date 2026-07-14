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
  /** True when the org has never activated an event before (server-verified). */
  isFirstEvent = false,
): EventActivationWarning {
  const planId = normalizePlanId(billingPlan)
  const plan = getPlan(planId)
  const baseAmount = plan.perEventPriceEur

  // First event is free on PAID plans only (Starter/Pro/Max). The Free plan
  // gets no free event; Partner is already comped below.
  const paidPlanIds: PlanId[] = ['arena', 'pro', 'max']
  if (isFirstEvent && paidPlanIds.includes(planId)) {
    return {
      planId,
      billAmountEur: 0,
      isComped: true,
      title: 'Activate event',
      message:
        `Your first event on the ${formatPlanLabel(planId)} plan is free. ` +
        'Activating records a €0 invoice. If you have not started the event yet, ' +
        'keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate at no cost',
    }
  }

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

  // Enterprise is billed directly (price on request), not per-event through this
  // flow. The DB invoice function already comps these the same as Partner.
  if (planId === 'enterprise') {
    return {
      planId,
      billAmountEur: 0,
      isComped: true,
      title: 'Activate event',
      message:
        'Activating this event will record it in your billing history on the Enterprise plan. ' +
        'Your Enterprise billing is arranged directly, so this does not generate a per-event charge here. ' +
        'If you have not started the event yet, keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate event',
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

  // The Free plan has no subscription and no card on file, so the fee is taken
  // up front — the event only goes live once payment clears.
  if (planId === 'rookie') {
    return {
      planId,
      billAmountEur,
      isComped: false,
      title: 'Pay to activate',
      message:
        `The ${formatPlanLabel(planId)} plan is pay-per-event, so this event costs ${priceLabel}.${promoNote} ` +
        'You will be asked to pay now, and the event goes live as soon as the payment clears. ' +
        'Once activated, an event cannot be run again — duplicate it to schedule another session.',
      confirmLabel: `Pay ${priceLabel} and activate`,
    }
  }

  return {
    planId,
    billAmountEur,
    isComped: false,
    title: 'Activate event — billing confirmation',
    message:
      `Activating this event will generate a bill of ${priceLabel} based on your ${formatPlanLabel(planId)} plan.${promoNote} ` +
      'We will charge the card saved with your subscription. ' +
      'If you have not started the event yet, keep it at Ready status to avoid being billed. ' +
      'Once activated, an event cannot be run again — duplicate it to schedule another session.',
    confirmLabel: `Activate and bill ${priceLabel}`,
  }
}

/**
 * When the monthly event allowance resets: midnight on the 1st of next month.
 * Matches the gate's `date_trunc('month', now())` window, which Postgres
 * evaluates in UTC — so this is computed in UTC too, not local time.
 */
export function formatLimitResetDate(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return next.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The activation gate (assert_event_activation_allowed) raises tagged Postgres
 * exceptions. They reach the client as raw messages like
 * "SUBSCRIPTION_REQUIRED: Start a subscription ...", which is not something an
 * organiser should ever read. Map the tag to plain language.
 *
 * Falls back to the original message so a genuinely unexpected DB error is still
 * visible rather than silently swallowed.
 */
export function friendlyActivationError(raw: string | null | undefined): string {
  const message = raw ?? ''

  if (message.includes('SUBSCRIPTION_REQUIRED')) {
    return 'Your subscription is not active. Start (or renew) your plan in Settings → Billing, then activate this event.'
  }
  if (message.includes('PREPAY_REQUIRED')) {
    return 'This event has not been paid for yet. On the Free plan each event is paid before it goes live.'
  }
  if (message.includes('EVENT_LIMIT_REACHED')) {
    // The DB message already carries the plan's actual number.
    const limit = message.match(/allows (\d+) event/)?.[1]
    const resets = formatLimitResetDate()
    const used = limit
      ? `You have used all ${limit} of your events this month.`
      : 'You have used all your events for this month.'
    return `${used} Your next event can be activated from ${resets}. Upgrade your plan to run more now.`
  }
  if (message.includes('TEAM_LIMIT_EXCEEDED')) {
    const limit = message.match(/allows (\d+) teams/)?.[1]
    return limit
      ? `This event has more teams than your plan allows (${limit} per event). Remove some teams or upgrade your plan.`
      : 'This event has more teams than your plan allows. Remove some teams or upgrade your plan.'
  }
  if (message.includes('ORG_SUSPENDED')) {
    return 'This organisation is suspended, so events cannot be activated. Contact support.'
  }

  return message || 'Could not activate this event.'
}

/**
 * Whether going to `active` should run the billing confirmation (and, on the Free
 * plan, collect payment) rather than flipping the status straight away.
 *
 * Keys off activated_at, not invoiced_at. Free-plan prepay creates the invoice
 * before the event goes live, so an invoice existing does NOT mean the event has
 * run. Using invoiced_at here would mean anyone who opened the checkout and then
 * closed it could never be shown the payment again — the dialog would be skipped,
 * the prepay step never runs, and the DB gate would just reject the activation
 * with no way forward.
 */
export function isActivationBillingRequired(
  currentStatus: string,
  nextStatus: string,
  activatedAt?: string | null,
): boolean {
  if (activatedAt) return false
  return nextStatus === 'active' && currentStatus !== 'active'
}
