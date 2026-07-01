import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import { EventInvoiceList } from '@/components/billing/EventInvoiceList'
import { PromoCodeSection } from '@/components/billing/PromoCodeSection'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { Card } from '@/components/ui/card'
import {
  partitionInvoices,
  useOrganizationInvoices,
} from '@/hooks/use-billing-invoices'
import {
  formatBillingPeriodLabel,
  formatEur,
  formatPlanLabel,
  formatSubscriptionPrice,
  getPlan,
  getVisiblePlans,
  normalizeBillingPeriod,
  normalizePlanId,
} from '@/lib/subscription-plans'
import { sumUnpaidDue } from '@/lib/billing-display'

type BillingOverviewProps = {
  organizationId: string | null | undefined
  billingPlan: string | null | undefined
  billingPeriod: string | null | undefined
  /** Client settings: show upgrade plan comparison. Admin view: hide. */
  showAvailablePlans?: boolean
  /** Admin client detail: show outstanding total summary. */
  showAdminSummary?: boolean
}

export function BillingOverview({
  organizationId,
  billingPlan,
  billingPeriod,
  showAvailablePlans = false,
  showAdminSummary = false,
}: BillingOverviewProps) {
  const invoicesQuery = useOrganizationInvoices(organizationId)
  const planId = normalizePlanId(billingPlan)
  const period = normalizeBillingPeriod(billingPeriod)
  const plan = getPlan(planId)

  const { unpaid, settled } = partitionInvoices(invoicesQuery.data ?? [])
  const unpaidTotal = sumUnpaidDue(invoicesQuery.data ?? [])

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
            Activated events awaiting payment. Pay online once Stripe is connected.
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
            Recurring plan billing will appear here when Stripe is connected.
          </p>
        </div>
        <Card className="border-border/80 space-y-3 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-foreground font-medium">{formatPlanLabel(planId)}</p>
              <p className="text-muted-foreground text-sm">
                {formatBillingPeriodLabel(period)} ·{' '}
                {formatSubscriptionPrice(plan, period)}
              </p>
            </div>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
              Not yet billed via Stripe
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Subscription payment history will be listed here after Stripe integration.
            Per-event charges above are separate from your monthly or yearly plan fee.
          </p>
        </Card>
      </section>

      <PromoCodeSection organizationId={organizationId} allowAdd={showAvailablePlans} />

      {showAvailablePlans ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Compare plans</h2>
            <p className="text-muted-foreground text-sm">
              Plan changes will be available when billing is fully enabled.
            </p>
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
