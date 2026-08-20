import { IconCheck } from '@/components/icons'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

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
  /** Design's per-card action: "Current plan" or "Upgrade". */
  action?: ReactNode
}

export function PlanDetailsCard({
  planId,
  billingPeriod = 'monthly',
  highlighted = false,
  compact = false,
  className,
  action,
}: PlanDetailsCardProps) {
  const { t } = useTranslation('admin')
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
              ? t('billing.noSubscription')
              : plan.priceOnRequest
                ? t('billing.contactForCustomPlan')
                : t('billing.periodBilling', { period: formatBillingPeriodLabel(period) })}
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
      <ul className="text-muted-foreground space-y-1.5 text-sm">
        {[
          plan.freeSubscription ? null : formatPerEventPrice(plan),
          formatEventLimit(plan),
          formatTeamLimit(plan),
          brandingNote,
        ]
          .filter(Boolean)
          .map((line) => (
            <li key={String(line)} className="flex items-start gap-2">
              <IconCheck className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
      </ul>
      {action ? <div className="pt-1">{action}</div> : null}
    </Card>
  )
}
