import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import { EventInvoiceList } from '@/components/billing/EventInvoiceList'
import { PromoCodeSection } from '@/components/billing/PromoCodeSection'
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

export function BillingOverview({
  organizationId,
  billingPlan,
  billingPeriod,
  paddleSubscriptionId = null,
  showAvailablePlans = false,
  showAdminSummary = false,
}: BillingOverviewProps) {
  const { notify } = useNotification()
  const invoicesQuery = useOrganizationInvoices(organizationId)
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

  return (
    <div className="space-y-8">
      {showAdminSummary && unpaid.length > 0 ? (
        <Card className="border-border/80 bg-muted/30 px-4 py-3 shadow-sm">
          <p className="text-foreground text-sm font-medium">
            Outstanding: {formatEur(unpaidTotal)} across {unpaid.length} unpaid event
            {unpaid.length === 1 ? '' : 's'}
          </p>
        </Card>
      ) : null}

      <section className="space-y-3" data-tour="billing-plan">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Current plan</h2>
          <p className="text-muted-foreground text-sm">
            {formatPlanLabel(planId)} · {formatBillingPeriodLabel(period)} billing
            {plan.hidden ? ' · Partner (comped)' : ''}
          </p>
        </div>
        <PlanDetailsCard
          planId={planId}
          billingPeriod={period}
          highlighted
          className="max-w-md"
        />
        <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>
        {plan.hidden ? (
          <p className="text-muted-foreground text-sm">
            Your Partner account is fully comped. Event activations are recorded at no
            charge.
          </p>
        ) : null}
      </section>

      <section className="space-y-3" data-tour="billing-unpaid">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Unpaid events</h2>
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
          />
        )}
      </section>

      <section className="space-y-3" data-tour="billing-history">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Payment history</h2>
          <p className="text-muted-foreground text-sm">
            Paid and comped event invoices, most recent first.
          </p>
        </div>
        {invoicesQuery.isLoading ? (
          <QueryLoading rows={3} />
        ) : invoicesQuery.isError ? null : (
          <EventInvoiceList
            invoices={settled}
            emptyMessage="No paid or comped event invoices yet."
          />
        )}
      </section>

      <section className="space-y-3" data-tour="billing-subscription">
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
                {formatBillingPeriodLabel(period)} ·{' '}
                {formatSubscriptionPrice(plan, period)}
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
        </Card>
      </section>

      <PromoCodeSection organizationId={organizationId} allowAdd={showAvailablePlans} />

      {showAvailablePlans ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Compare plans</h2>
            <p className="text-muted-foreground text-sm">
              {paddleSubscriptionId
                ? 'Contact us to switch plans on an active subscription.'
                : 'Start your subscription on the current plan above, or contact us to pick a different one.'}
            </p>
            <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {getVisiblePlans().map((visiblePlan) => (
              <PlanDetailsCard
                key={visiblePlan.id}
                planId={visiblePlan.id}
                billingPeriod={period}
                highlighted={visiblePlan.id === planId}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
