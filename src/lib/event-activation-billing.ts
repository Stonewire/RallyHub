import { i18n } from '@/lib/i18n'

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
  /**
   * organizations.custom_per_event_price_eur (P6.2). null = the plan's normal
   * per-event price; 0 = events are included in the custom subscription. Must
   * mirror create_event_activation_invoice so the preview matches the invoice.
   */
  customPerEventPriceEur: number | null = null,
  /**
   * events.open_joining (P6.3): teams are unknown at activation, so the
   * activation bill carries NO team surcharge; it settles at event end from
   * actually-claimed teams. Must mirror create_event_activation_invoice.
   */
  openJoining = false,
  /**
   * P6.4: the event is recurring, so "cannot be run again" would be wrong.
   * The billing itself is identical; only the closing note changes.
   */
  recurringEvent = false,
): EventActivationWarning {
  const planId = normalizePlanId(billingPlan)
  const plan = getPlan(planId)
  const hasCustomPerEvent =
    customPerEventPriceEur != null && Number.isFinite(Number(customPerEventPriceEur))
  const baseAmount = hasCustomPerEvent
    ? Number(customPerEventPriceEur)
    : plan.perEventPriceEur
  const teamCharge = openJoining
    ? { count: 0, amountEur: 0 }
    : additionalTeamCharge(teamCount)
  const extraTeamCount = teamCharge.count
  const extraTeamChargeEur = teamCharge.amountEur

  if (planId === 'partner') {
    return {
      planId,
      billAmountEur: 0,
      extraTeamCount: 0,
      extraTeamChargeEur: 0,
      isComped: true,
      title: i18n.t('admin:events.activate.title'),
      message: [
        i18n.t('admin:events.activate.partnerMessage', { plan: formatPlanLabel(planId) }),
        i18n.t('admin:events.activate.readyUntilLive'),
      ].join(' '),
      confirmLabel: i18n.t('admin:events.activate.confirmFree'),
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
      title: i18n.t('admin:events.activate.title'),
      message: [
        i18n.t('admin:events.activate.customMessage'),
        i18n.t('admin:events.activate.readyUntilLive'),
      ].join(' '),
      confirmLabel: i18n.t('admin:events.activate.title'),
    }
  }

  const discountPct = Math.min(100, Math.max(0, Math.round(eventPromoDiscountPercent)))
  const afterPromo = Math.max(
    Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100,
    0,
  )
  // Educational 50% stacks on top of the promo discount (matches migration 059).
  // A staff-set custom per-event price is the negotiated NET figure: neither
  // discount applies to it (and the invoice function does not consume the
  // promo code), matching create_event_activation_invoice (20260827180000).
  const discountedBaseAmount = hasCustomPerEvent
    ? baseAmount
    : educationalApproved
      ? Math.round((afterPromo / 2) * 100) / 100
      : afterPromo
  // Event discounts apply to the event itself. Purchased team capacity remains
  // €10/team so a generic promo cannot silently grant unpaid add-ons.
  const billAmountEur = discountedBaseAmount + extraTeamChargeEur

  if (billAmountEur === 0) {
    // A €0 bill from the custom "events included" override reads differently
    // from a promo making the event free.
    const freeMessage =
      hasCustomPerEvent && baseAmount === 0
        ? i18n.t('admin:events.activate.customIncludedMessage')
        : i18n.t('admin:events.activate.freeByPromoMessage', {
            percent: discountPct,
            price: formatEur(baseAmount),
            plan: formatPlanLabel(planId),
          })
    return {
      planId,
      billAmountEur: 0,
      extraTeamCount,
      extraTeamChargeEur,
      isComped: true,
      title: i18n.t('admin:events.activate.title'),
      message: [
        freeMessage,
        // Free base or not, an open-joining event can still owe team fees at
        // the end, so the settle note stays visible here too.
        openJoining ? i18n.t('admin:events.activate.openJoiningSettleNote') : '',
        i18n.t('admin:events.activate.readyUntilLive'),
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: i18n.t('admin:events.activate.confirmFree'),
    }
  }

  const priceLabel = formatEur(billAmountEur)
  // Discount notes only show when a discount actually applies: never against a
  // custom per-event price (the negotiated net figure, no promo consumed) and
  // never against a €0 base, which has no event fee to act on.
  const promoNote =
    discountPct > 0 && baseAmount > 0 && !hasCustomPerEvent
      ? i18n.t('admin:events.activate.promoNote', {
          percent: discountPct,
          price: formatEur(baseAmount),
        })
      : ''
  const educationalNote =
    educationalApproved && baseAmount > 0 && !hasCustomPerEvent
      ? i18n.t('admin:events.activate.educationalNote')
      : ''
  // Reaching here with a €0 custom base means the bill is additional teams
  // only; say the event fee itself is included so the number adds up.
  const customIncludedNote =
    hasCustomPerEvent && baseAmount === 0
      ? i18n.t('admin:events.activate.customFeeIncludedNote')
      : ''
  // Open joining replaces the team-charge note entirely: the surcharge is
  // settled from actually-claimed teams when the event ends, never here.
  const teamChargeNote = openJoining
    ? i18n.t('admin:events.activate.openJoiningSettleNote')
    : extraTeamCount > 0
      ? i18n.t('admin:events.activate.extraTeamsNote', {
          count: extraTeamCount,
          amount: formatEur(extraTeamChargeEur),
          each: formatEur(ADDITIONAL_TEAM_PRICE_EUR),
        })
      : i18n.t('admin:events.activate.teamsIncludedNote')

  // Pay Per Event has no subscription, so it usually has no card on file: it
  // pays the invoice afterwards. If a card IS saved, the charge happens
  // automatically, same as the paid plans.
  const paymentNote =
    planId === 'rookie'
      ? i18n.t('admin:events.activate.payPerEventNote')
      : i18n.t('admin:events.activate.subscriptionCardNote')

  return {
    planId,
    billAmountEur,
    extraTeamCount,
    extraTeamChargeEur,
    isComped: false,
    title: i18n.t('admin:events.activate.billingTitle'),
    message: [
      i18n.t('admin:events.activate.billMessage', {
        price: priceLabel,
        plan: formatPlanLabel(planId),
      }),
      teamChargeNote,
      customIncludedNote,
      promoNote,
      educationalNote,
      paymentNote,
      i18n.t('admin:events.activate.readyToAvoidBilling'),
      recurringEvent
        ? i18n.t('admin:events.activate.recurringNote')
        : i18n.t('admin:events.activate.cannotRunAgain'),
    ]
      .filter(Boolean)
      .join(' '),
    confirmLabel: i18n.t('admin:events.activate.confirmBill', { price: priceLabel }),
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
    return i18n.t('admin:events.activate.errors.subscriptionRequired')
  }
  if (message.includes('UNPAID_INVOICE')) {
    return i18n.t('admin:events.activate.errors.unpaidInvoice')
  }
  if (message.includes('EVENT_LIMIT_REACHED')) {
    // The DB message already carries the plan's actual number.
    const limit = message.match(/allows (\d+) event/)?.[1]
    const used = limit
      ? i18n.t('admin:events.activate.errors.eventLimitUsed', { limit })
      : i18n.t('admin:events.activate.errors.eventLimitUsedUnknown')
    const next = i18n.t('admin:events.activate.errors.eventLimitResets', {
      date: formatLimitResetDate(),
    })
    return `${used} ${next}`
  }
  if (message.includes('TEAM_LIMIT_EXCEEDED')) {
    const limit = message.match(/allows (\d+) teams/)?.[1]
    return limit
      ? i18n.t('admin:events.activate.errors.teamLimitWithNumber', { limit })
      : i18n.t('admin:events.activate.errors.teamLimit')
  }
  if (message.includes('ORG_SUSPENDED')) {
    return i18n.t('admin:events.activate.errors.orgSuspended')
  }

  return message || i18n.t('admin:events.activate.errors.generic')
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
