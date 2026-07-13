import { Card } from '@/components/ui/card'
import {
  formatBillingPeriodLabel,
  formatBrandingNote,
  formatEventLimit,
  formatPerEventPrice,
  formatSubscriptionPrice,
  formatTeamLimit,
  getPlan,
  normalizeBillingPeriod,
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
            {formatBillingPeriodLabel(period)} billing
          </p>
        ) : null}
      </div>
      <p className="text-foreground text-2xl font-bold tabular-nums">
        {formatSubscriptionPrice(plan, period)}
      </p>
      <ul className="text-muted-foreground space-y-1 text-sm">
        <li>{formatPerEventPrice(plan)}</li>
        <li>{formatEventLimit(plan)}</li>
        <li>{formatTeamLimit(plan)}</li>
        {brandingNote ? <li>{brandingNote}</li> : null}
      </ul>
    </Card>
  )
}
