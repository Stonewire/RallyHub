import { CreditCard } from 'lucide-react'
import { useState } from 'react'

import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import { EventInvoiceList } from '@/components/billing/EventInvoiceList'
import { PromoCodeSection } from '@/components/billing/PromoCodeSection'
import { SubscriptionChangeForm } from '@/components/billing/SubscriptionChangeForm'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  partitionInvoices,
  usePayEventInvoiceWithPaddle,
  useOrganizationInvoices,
} from '@/hooks/use-billing-invoices'
import { usePaddleSubscriptionCheckout } from '@/hooks/use-paddle-subscription'
import { useMonthlyEventUsage } from '@/hooks/use-plan-usage'
import { openBillingPortal, openInvoicePdf } from '@/lib/paddle'
import {
  formatBillingPeriodLabel,
  formatEur,
  formatPlanLabel,
  formatSubscriptionPrice,
  getPlan,
  getVisiblePlans,
  normalizeBillingPeriod,
  normalizePlanId,
  VAT_DISCLAIMER,
} from '@/lib/subscription-plans'
import { sumUnpaidDue } from '@/lib/billing-display'
import { useOptionalTenant } from '@/contexts/tenant-context'

type BillingOverviewProps = {
  organizationId: string | null | undefined
  billingPlan: string | null | undefined
  billingPeriod: string | null | undefined
  /** Set once an org's subscription is active via Paddle. */
  paddleSubscriptionId?: string | null
  /** Client settings: show upgrade plan comparison. Admin view: hide. */
  showAvailablePlans?: boolean
  /** Admin client detail: show outstanding total summary. */
  showAdminSummary?: boolean
}

const PLAN_CHANGES_ENABLED = import.meta.env.VITE_ENABLE_PLAN_CHANGES === 'true'

export function BillingOverview({
  organizationId,
  billingPlan,
  billingPeriod,
  paddleSubscriptionId = null,
  showAvailablePlans = false,
  showAdminSummary = false,
}: BillingOverviewProps) {
  const { notify } = useNotification()
  const isDemo = useOptionalTenant()?.tenantOrg?.is_demo === true
  const [openingPortal, setOpeningPortal] = useState(false)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const invoicesQuery = useOrganizationInvoices(organizationId)
  const eventsUsed = useMonthlyEventUsage(organizationId).data ?? 0
  const payInvoice = usePayEventInvoiceWithPaddle(organizationId)
  const startSubscription = usePaddleSubscriptionCheckout(organizationId)
  const planId = normalizePlanId(billingPlan)
  const period = normalizeBillingPeriod(billingPeriod)
  const plan = getPlan(planId)

  const { unpaid, settled } = partitionInvoices(invoicesQuery.data ?? [])
  const unpaidTotal = sumUnpaidDue(invoicesQuery.data ?? [])

  async function handlePayInvoice(invoiceId: string) {
    try {
      const result = await payInvoice.mutateAsync(invoiceId)
      if (result === 'completed') notify('Payment received — thank you!')
      else if (result === 'closed') notify('Checkout closed — the invoice is still unpaid.')
      else if (result === 'error') notify('Something went wrong with the payment. Please try again.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not start payment.')
    }
  }

  async function handleDownloadInvoice(invoiceId: string) {
    if (!organizationId) return
    setDownloadingInvoiceId(invoiceId)
    try {
      await openInvoicePdf(organizationId, invoiceId, isDemo)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not fetch the invoice.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  async function handleOpenPortal() {
    if (!organizationId) return
    setOpeningPortal(true)
    try {
      await openBillingPortal(organizationId, isDemo)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not open billing details.')
    } finally {
      setOpeningPortal(false)
    }
  }

  async function handleStartSubscription() {
    try {
      const result = await startSubscription.mutateAsync({ planId, billingPeriod: period })
      if (result === 'completed') notify('Subscription started — thank you!')
      else if (result === 'closed') notify('Checkout closed — no subscription was started.')
      else if (result === 'error') notify('Something went wrong starting checkout. Please try again.')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not start checkout.')
    }
  }

  // Only paid, self-serve plans can start a Paddle subscription from here.
  const canStartSubscription = !plan.hidden && !plan.freeSubscription && !plan.priceOnRequest

  // Client Billing uses the design's two columns: plan management on the left,
  // money on the right. The super-admin client view stays a single column.
  const twoColumn = showAvailablePlans

  return (
    <div
      className={
        twoColumn
          ? 'grid items-start gap-4 xl:grid-cols-[minmax(17rem,1fr)_minmax(0,2fr)]'
          : 'space-y-8'
      }
    >
      {showAdminSummary && unpaid.length > 0 ? (
        <Card className="border-border/80 bg-muted/30 px-4 py-3 shadow-sm">
          <p className="text-foreground text-sm font-medium">
            Outstanding: {formatEur(unpaidTotal)} across {unpaid.length} unpaid event
            {unpaid.length === 1 ? '' : 's'}
          </p>
        </Card>
      ) : null}

      <section className={showAvailablePlans ? 'space-y-3 xl:col-start-1 xl:row-start-1' : 'space-y-3'} data-tour="billing-plan">
        <div>
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.08em] uppercase">Current Plan</p>
          <p className="text-muted-foreground text-sm">
            {formatPlanLabel(planId)} ·{' '}
            {plan.freeSubscription
              ? 'No subscription'
              : plan.priceOnRequest
                ? 'Custom billing'
                : `${formatBillingPeriodLabel(period)} billing`}
            {plan.hidden ? ' · Partner (comped)' : ''}
          </p>
        </div>
        <PlanDetailsCard
          planId={planId}
          billingPeriod={period}
          highlighted
          className="w-full"
        />
        {plan.monthlyEventLimit !== null ? (
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium tabular-nums">
              {eventsUsed} of {plan.monthlyEventLimit}
            </span>{' '}
            event{plan.monthlyEventLimit === 1 ? '' : 's'} activated this month
            {eventsUsed >= plan.monthlyEventLimit
              ? ' — you have reached your plan limit. Upgrade to run more.'
              : '.'}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>
        {plan.hidden ? (
          <p className="text-muted-foreground text-sm">
            Your Partner account is fully comped. Event activations are recorded at no
            charge.
          </p>
        ) : null}
      </section>

      <section className={showAvailablePlans ? 'space-y-3 xl:col-start-2 xl:row-start-1' : 'space-y-3'} data-tour="billing-unpaid">
        <div>
          <h2 className="text-foreground text-base font-bold">Payments &amp; Invoices</h2>
          <p className="text-muted-foreground text-sm">
            Activated events awaiting payment.
            {showAvailablePlans ? ' Pay online below.' : ' Payable online from the client’s own settings.'}
          </p>
        </div>
        {invoicesQuery.isLoading ? (
          <QueryLoading rows={3} />
        ) : invoicesQuery.isError ? (
          <QueryError message={invoicesQuery.error.message} />
        ) : (
          <EventInvoiceList
            invoices={unpaid}
            emptyMessage="No unpaid event invoices."
            showPayIndicator
            onPay={showAvailablePlans ? handlePayInvoice : undefined}
            payingInvoiceId={payInvoice.isPending ? (payInvoice.variables ?? null) : null}
            layout={twoColumn ? 'table' : 'cards'}
          />
        )}
      </section>

      <section className={showAvailablePlans ? 'space-y-3 xl:col-start-2 xl:row-start-2' : 'space-y-3'} data-tour="billing-history">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Payment history</h2>
          <p className="text-muted-foreground text-sm">
            Paid and comped event invoices, most recent first. Download the invoice
            for anything you have paid.
          </p>
        </div>
        {invoicesQuery.isLoading ? (
          <QueryLoading rows={3} />
        ) : invoicesQuery.isError ? null : (
          <EventInvoiceList
            invoices={settled}
            emptyMessage="No paid or comped event invoices yet."
            onDownload={handleDownloadInvoice}
            downloadingInvoiceId={downloadingInvoiceId}
            layout={twoColumn ? 'table' : 'cards'}
          />
        )}
      </section>

      <section className={showAvailablePlans ? 'space-y-3 xl:col-start-1 xl:row-start-2' : 'space-y-3'} data-tour="billing-subscription">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Subscription</h2>
          <p className="text-muted-foreground text-sm">
            Your recurring plan fee, billed via Paddle. Separate from the per-event charges above.
          </p>
        </div>
        <Card className="border-border/80 space-y-3 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-foreground font-medium">{formatPlanLabel(planId)}</p>
              <p className="text-muted-foreground text-sm">
                {plan.freeSubscription || plan.priceOnRequest
                  ? formatSubscriptionPrice(plan, period)
                  : `${formatBillingPeriodLabel(period)} · ${formatSubscriptionPrice(plan, period)}`}
              </p>
            </div>
            {paddleSubscriptionId ? (
              <span className="rounded-full border border-[#1f9d55]/40 bg-[#1f9d55]/10 px-2 py-0.5 text-xs font-medium text-[#1f9d55]">
                Active — billed via Paddle
              </span>
            ) : showAvailablePlans && canStartSubscription ? (
              <NeoButton
                variant="accent"
                size="sm"
                onClick={() => void handleStartSubscription()}
                disabled={startSubscription.isPending}
              >
                {startSubscription.isPending ? 'Opening checkout…' : 'Start subscription'}
              </NeoButton>
            ) : (
              <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                Not yet started
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>
          {(PLAN_CHANGES_ENABLED || isDemo) && showAvailablePlans && organizationId && (isDemo || paddleSubscriptionId) && !plan.priceOnRequest ? (
            <SubscriptionChangeForm
              key={`${planId}-${period}`}
              organizationId={organizationId}
              currentPlanId={planId}
              currentBillingPeriod={period}
            />
          ) : null}
        </Card>
      </section>

      {showAvailablePlans ? (
        <section className="space-y-3 xl:col-start-1 xl:row-start-3" data-tour="billing-payment-methods">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Billing details</h2>
            <p className="text-muted-foreground text-sm">
              Manage your saved cards, billing address and invoices. Save a card to
              pay in one click, and to have event fees charged automatically once you
              are on a subscription.
            </p>
          </div>
          <Card className="border-border/80 space-y-3 bg-card p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">
              Card details are handled entirely by Paddle, our payment provider.
              RallyHub never sees or stores your card.
            </p>
            <NeoButton
              variant="surface"
              size="sm"
              onClick={() => void handleOpenPortal()}
              disabled={openingPortal}
            >
              <CreditCard className="size-4" aria-hidden />
              {openingPortal ? 'Opening…' : 'Manage billing details'}
            </NeoButton>
          </Card>
        </section>
      ) : null}

      <div className={showAvailablePlans ? 'xl:col-start-1 xl:row-start-4' : undefined}>
        <PromoCodeSection
          organizationId={organizationId}
          allowAdd={showAvailablePlans && !isDemo}
        />
      </div>

      {showAvailablePlans ? (
        <section className="space-y-3 xl:col-start-1 xl:row-start-5">
          <div>
            <h2 className="text-foreground text-[10px] font-semibold tracking-[0.08em] uppercase">
              Available plans
            </h2>
            <p className="text-muted-foreground text-sm">
              {isDemo
                ? 'Use Change subscription above to try Pay Per Event, Starter, or Pro.'
                : paddleSubscriptionId
                ? PLAN_CHANGES_ENABLED
                  ? 'Use Change subscription above to switch between Starter and Pro.'
                  : 'Plan changes will be enabled after the final pricing structure is confirmed.'
                : 'Start your subscription on the current plan above, or contact us to pick a different one.'}
            </p>
            <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>
          </div>
          <div className="grid gap-3">
            {getVisiblePlans().map((visiblePlan) => (
              <PlanDetailsCard
                key={visiblePlan.id}
                planId={visiblePlan.id}
                billingPeriod={period}
                highlighted={visiblePlan.id === planId}
                action={
                  visiblePlan.id === planId ? (
                    <NeoButton variant="surface" size="sm" className="w-full" disabled>
                      Current plan
                    </NeoButton>
                  ) : visiblePlan.priceOnRequest ? (
                    <NeoButton variant="surface" size="sm" className="w-full" asChild>
                      <a href="mailto:hello@rallyhub.games?subject=Custom%20plan">Contact us</a>
                    </NeoButton>
                  ) : (
                    // Self-serve switching is gated by the same flag as the
                    // change form, so this scrolls there instead of implying an
                    // upgrade path that is not enabled yet.
                    <NeoButton
                      variant="accent"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        document
                          .querySelector('[data-tour="billing-subscription"]')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    >
                      Upgrade
                    </NeoButton>
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
