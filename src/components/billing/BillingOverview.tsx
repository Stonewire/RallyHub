import { CreditCard } from 'lucide-react'
import { useState } from 'react'

import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import { EventInvoiceList } from '@/components/billing/EventInvoiceList'
import { PlansModal } from '@/components/billing/PlansModal'
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
  const [plansOpen, setPlansOpen] = useState(false)
  const invoicesQuery = useOrganizationInvoices(organizationId)
  const eventsUsed = useMonthlyEventUsage(organizationId).data ?? 0
  const payInvoice = usePayEventInvoiceWithPaddle(organizationId)
  const startSubscription = usePaddleSubscriptionCheckout(organizationId)
  const planId = normalizePlanId(billingPlan)
  const period = normalizeBillingPeriod(billingPeriod)
  const plan = getPlan(planId)

  const { unpaid } = partitionInvoices(invoicesQuery.data ?? [])
  // One list for the whole section: unpaid first so nothing owed is buried,
  // then everything else newest first.
  const allInvoices = [...(invoicesQuery.data ?? [])].sort((a, b) => {
    const aUnpaid = unpaid.some((invoice) => invoice.id === a.id)
    const bUnpaid = unpaid.some((invoice) => invoice.id === b.id)
    if (aUnpaid !== bUnpaid) return aUnpaid ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
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

      {/* One Current Plan card. The page used to say the same thing three
          times: a heading, a plan card, and a Subscription section that
          repeated the name, price and status. Everything about the plan lives
          here now, including billing details and starting the subscription. */}
      <section
        className={showAvailablePlans ? 'space-y-3 xl:col-start-1 xl:row-start-1' : 'space-y-3'}
        data-tour="billing-plan"
      >
        <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold tracking-[0.08em] uppercase">
                Current Plan
              </p>
              <p className="text-foreground text-lg font-bold">{formatPlanLabel(planId)}</p>
              <p className="text-muted-foreground text-sm">
                {plan.freeSubscription
                  ? 'No subscription'
                  : plan.priceOnRequest
                    ? 'Custom billing'
                    : `${formatBillingPeriodLabel(period)} · ${formatSubscriptionPrice(plan, period)}`}
                {plan.hidden ? ' · Partner (comped)' : ''}
              </p>
            </div>
            {paddleSubscriptionId ? (
              <span className="rounded-full border border-[#1f9d55]/40 bg-[#1f9d55]/10 px-2 py-0.5 text-xs font-medium text-[#1f9d55]">
                Active
              </span>
            ) : plan.hidden ? (
              <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                Comped
              </span>
            ) : (
              <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                Not started
              </span>
            )}
          </div>

          <PlanDetailsCard
            planId={planId}
            billingPeriod={period}
            compact
            className="w-full border-0 bg-transparent p-0 shadow-none"
          />

          {plan.monthlyEventLimit !== null ? (
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium tabular-nums">
                {eventsUsed} of {plan.monthlyEventLimit}
              </span>{' '}
              event{plan.monthlyEventLimit === 1 ? '' : 's'} activated this month
              {eventsUsed >= plan.monthlyEventLimit
                ? ' — you have reached your plan limit.'
                : '.'}
            </p>
          ) : null}

          {plan.hidden ? (
            <p className="text-muted-foreground text-sm">
              Your Partner account is fully comped. Event activations are recorded at no
              charge.
            </p>
          ) : null}

          <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>

          {showAvailablePlans ? (
            <div className="border-border flex flex-wrap gap-2 border-t pt-3">
              {!paddleSubscriptionId && canStartSubscription ? (
                <NeoButton
                  variant="accent"
                  size="sm"
                  onClick={() => void handleStartSubscription()}
                  disabled={startSubscription.isPending}
                >
                  {startSubscription.isPending ? 'Opening checkout…' : 'Start subscription'}
                </NeoButton>
              ) : null}
              <NeoButton
                variant="surface"
                size="sm"
                onClick={() => void handleOpenPortal()}
                disabled={openingPortal}
              >
                <CreditCard className="size-4" aria-hidden />
                {openingPortal ? 'Opening…' : 'Manage billing details'}
              </NeoButton>
              <NeoButton variant="surface" size="sm" onClick={() => setPlansOpen(true)}>
                View other plans
              </NeoButton>
            </div>
          ) : null}

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

      {/* One invoice list, newest first, unpaid rows carrying Pay now. The
          separate Payment history section duplicated the same table. */}
      <section
        className={showAvailablePlans ? 'space-y-3 xl:col-start-2 xl:row-span-2 xl:row-start-1' : 'space-y-3'}
        data-tour="billing-unpaid"
      >
        <div>
          <h2 className="text-foreground text-base font-bold">Payments &amp; Invoices</h2>
          <p className="text-muted-foreground text-sm">
            {showAvailablePlans
              ? 'Newest first. Anything unpaid can be paid here, and paid invoices can be downloaded.'
              : 'Newest first. Payable from the client’s own settings.'}
          </p>
        </div>
        {invoicesQuery.isLoading ? (
          <QueryLoading rows={4} />
        ) : invoicesQuery.isError ? (
          <QueryError message={invoicesQuery.error.message} />
        ) : (
          <EventInvoiceList
            invoices={allInvoices}
            emptyMessage="No invoices yet."
            showPayIndicator
            onPay={showAvailablePlans ? handlePayInvoice : undefined}
            payingInvoiceId={payInvoice.isPending ? (payInvoice.variables ?? null) : null}
            onDownload={handleDownloadInvoice}
            downloadingInvoiceId={downloadingInvoiceId}
            layout={twoColumn ? 'table' : 'cards'}
          />
        )}
      </section>

      <div className={showAvailablePlans ? 'xl:col-start-1 xl:row-start-2' : undefined}>
        <PromoCodeSection
          organizationId={organizationId}
          allowAdd={showAvailablePlans && !isDemo}
        />
      </div>

      {plansOpen ? (
        <PlansModal
          currentPlanId={planId}
          billingPeriod={period}
          onClose={() => setPlansOpen(false)}
        />
      ) : null}

    </div>
  )
}
