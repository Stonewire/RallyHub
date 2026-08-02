import { RALLYHUB_CONTACT_EMAIL } from '@/constants/contact'
import { IconClose } from '@/components/icons'

import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  VAT_DISCLAIMER,
  getVisiblePlans,
  type BillingPeriod,
  type PlanId,
} from '@/lib/subscription-plans'

type PlansModalProps = {
  currentPlanId: PlanId
  billingPeriod: BillingPeriod
  onClose: () => void
}

/**
 * Every plan side by side, with the current one marked.
 *
 * Lifted out of the Billing page: it was a stack of cards below the fold that
 * repeated what the Current Plan card already said. As a modal it is there when
 * someone is comparing and out of the way when they are not.
 */
export function PlansModal({ currentPlanId, billingPeriod, onClose }: PlansModalProps) {
  const plans = getVisiblePlans()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className="border-border/80 max-h-[88vh] w-full max-w-4xl overflow-auto bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">Plans</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Your current plan is marked. {VAT_DISCLAIMER}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <IconClose className="size-4" />
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanDetailsCard
              key={plan.id}
              planId={plan.id}
              billingPeriod={billingPeriod}
              highlighted={plan.id === currentPlanId}
              action={
                plan.id === currentPlanId ? (
                  <NeoButton variant="surface" size="sm" className="w-full" disabled>
                    Current plan
                  </NeoButton>
                ) : plan.priceOnRequest ? (
                  <NeoButton variant="surface" size="sm" className="w-full" asChild>
                    <a href={`mailto:${RALLYHUB_CONTACT_EMAIL}?subject=Custom%20plan`}>Contact us</a>
                  </NeoButton>
                ) : (
                  // Self-serve switching is gated behind PLAN_CHANGES_ENABLED, so
                  // this points at the person who can do it rather than implying
                  // an upgrade path that is not wired up.
                  <NeoButton variant="surface" size="sm" className="w-full" asChild>
                    <a href={`mailto:${RALLYHUB_CONTACT_EMAIL}?subject=Switch%20to%20${encodeURIComponent(plan.name)}`}>
                      Ask us to switch
                    </a>
                  </NeoButton>
                )
              }
            />
          ))}
        </div>
      </Card>
    </div>
  )
}
