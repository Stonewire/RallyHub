import { Card } from '@/components/ui/card'
import {
  formatBillingPeriodLabel,
  formatBrandingNote,
  formatEventLimit,
  formatPerEventPrice,
  formatTeamLimit,
  getPlan,
  normalizeBillingPeriod,
  planPriceDisplay,
  type BillingPeriod,
  type PlanId,
} from '@/lib/subscription-plans'
import { cn } from '@/lib/utils'

type PlanDetailsCardProps = {
  planId: PlanId | string
  billingPeriod?: BillingPeriod | string | null
  highlighted?: boolean
  compact?: boolean
  className?: string
}

export function PlanDetailsCard({
  planId,
  billingPeriod = 'monthly',
  highlighted = false,
  compact = false,
  className,
}: PlanDetailsCardProps) {
  const plan = getPlan(planId)
  const period = normalizeBillingPeriod(billingPeriod)
  const brandingNote = formatBrandingNote(plan)
  const price = planPriceDisplay(plan)

  return (
    <Card
      className={cn(
        'border-border/80 bg-card shadow-sm',
        compact ? 'space-y-2 p-4' : 'space-y-3 p-5',
        highlighted && 'ring-primary/40 ring-2',
        className,
      )}
    >
      <div>
        <p className="text-foreground font-semibold">{plan.name}</p>
        {!compact ? (
          <p className="text-muted-foreground mt-0.5 text-sm">
            {plan.freeSubscription
              ? 'No subscription'
              : plan.priceOnRequest
                ? 'Contact us for a custom plan'
                : `${formatBillingPeriodLabel(period)} billing`}
          </p>
        ) : null}
      </div>
      <div>
        <p className="text-foreground text-2xl font-bold tabular-nums">{price.headline}</p>
        {price.yearlyNote ? (
          <p className="text-muted-foreground text-xs">{price.yearlyNote}</p>
        ) : null}
        {price.monthlyNote ? (
          <p className="text-muted-foreground text-xs">{price.monthlyNote}</p>
        ) : null}
      </div>
      <ul className="text-muted-foreground space-y-1 text-sm">
        {!plan.freeSubscription ? <li>{formatPerEventPrice(plan)}</li> : null}
        <li>{formatEventLimit(plan)}</li>
        <li>{formatTeamLimit(plan)}</li>
        {brandingNote ? <li>{brandingNote}</li> : null}
      </ul>
    </Card>
  )
}
