import {
  ADDITIONAL_TEAM_PRICE_EUR,
  additionalTeamCharge,
  formatEur,
  formatPlanLabel,
  getPlan,
  INCLUDED_TEAMS_PER_EVENT,
  normalizePlanId,
  type PlanId,
} from '@/lib/subscription-plans'

export type EventActivationWarning = {
  planId: PlanId
  billAmountEur: number
  extraTeamCount: number
  extraTeamChargeEur: number
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
  /** Saved team count for the event being activated. */
  teamCount = INCLUDED_TEAMS_PER_EVENT,
): EventActivationWarning {
  const planId = normalizePlanId(billingPlan)
  const plan = getPlan(planId)
  const baseAmount = plan.perEventPriceEur
  const teamCharge = additionalTeamCharge(teamCount)
  const extraTeamCount = teamCharge.count
  const extraTeamChargeEur = teamCharge.amountEur

  if (planId === 'partner') {
    return {
      planId,
      billAmountEur: 0,
      extraTeamCount: 0,
      extraTeamChargeEur: 0,
      isComped: true,
      title: 'Activate event',
      message:
        `Activating this event will record it in your billing history on the ${formatPlanLabel(planId)} plan. ` +
        'Your Partner plan includes events at no cost (100% discount). ' +
        'If you have not started the event yet, keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate at no cost',
    }
  }

  // Custom is billed directly (price on request), not per-event through this
  // flow. The DB invoice function already comps these the same as Partner.
  if (planId === 'enterprise') {
    return {
      planId,
      billAmountEur: 0,
      extraTeamCount: 0,
      extraTeamChargeEur: 0,
      isComped: true,
      title: 'Activate event',
      message:
        'Activating this event will record it in your billing history on the Custom plan. ' +
        'Your Custom billing is arranged directly, so this does not generate a per-event charge here. ' +
        'If you have not started the event yet, keep it at Ready status until you are ready to go live.',
      confirmLabel: 'Activate event',
    }
  }

  const discountPct = Math.min(100, Math.max(0, Math.round(eventPromoDiscountPercent)))
  const afterPromo = Math.max(
    Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100,
    0,
  )
  // Educational 50% stacks on top of the promo discount (matches migration 059).
  const discountedBaseAmount = educationalApproved
    ? Math.round((afterPromo / 2) * 100) / 100
    : afterPromo
  // Event discounts apply to the event itself. Purchased team capacity remains
  // €10/team so a generic promo cannot silently grant unpaid add-ons.
  const billAmountEur = discountedBaseAmount + extraTeamChargeEur

  if (billAmountEur === 0) {
    return {
      planId,
      billAmountEur: 0,
      extraTeamCount,
      extraTeamChargeEur,
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
      ? ` A promo code applies ${discountPct}% off the ${formatEur(baseAmount)} event fee.`
      : ''
  const educationalNote = educationalApproved
    ? ' The approved educational discount applies to the remaining event fee.'
    : ''
  const teamChargeNote = extraTeamCount > 0
    ? ` This includes ${formatEur(extraTeamChargeEur)} for ${extraTeamCount} additional team${extraTeamCount === 1 ? '' : 's'} at ${formatEur(ADDITIONAL_TEAM_PRICE_EUR)} each.`
    : ' Five teams are included at no additional charge.'

  // Pay Per Event has no subscription, so it usually has no card on file — it
  // pays the invoice afterwards. If a card IS saved, the charge happens
  // automatically, same as the paid plans.
  const paymentNote =
    planId === 'rookie'
      ? 'You can pay it from Settings → Billing, or it is charged automatically if you have a card saved. Your next event needs this one settled first.'
      : 'We will charge the card saved with your subscription.'

  return {
    planId,
    billAmountEur,
    extraTeamCount,
    extraTeamChargeEur,
    isComped: false,
    title: 'Activate event — billing confirmation',
    message:
      `Activating this event will generate a bill of ${priceLabel} based on your ${formatPlanLabel(planId)} plan.${teamChargeNote}${promoNote}${educationalNote} ` +
      `${paymentNote} ` +
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
  if (message.includes('UNPAID_INVOICE')) {
    return 'You have an unpaid event invoice. Settle it in Settings → Billing before activating another event.'
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
      ? `This event has more teams than your plan includes (${limit} per event). Remove some teams or purchase additional team capacity.`
      : 'This event has more teams than your plan includes. Remove some teams or purchase additional team capacity.'
  }
  if (message.includes('ORG_SUSPENDED')) {
    return 'This organisation is suspended, so events cannot be activated. Contact support.'
  }

  return message || 'Could not activate this event.'
}

/**
 * Whether going to `active` should run the billing confirmation rather than
 * flipping the status straight away. `activated_at` is the one-way lifecycle
 * marker; invoice creation and payment status are separate concerns.
 */
export function isActivationBillingRequired(
  currentStatus: string,
  nextStatus: string,
  activatedAt?: string | null,
): boolean {
  if (activatedAt) return false
  return nextStatus === 'active' && currentStatus !== 'active'
}
