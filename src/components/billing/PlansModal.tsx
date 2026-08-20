import { RALLYHUB_CONTACT_EMAIL } from '@/constants/contact'
import { IconClose } from '@/components/icons'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('admin')
  const plans = getVisiblePlans()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className="border-border/80 max-h-[88vh] w-full max-w-4xl overflow-auto bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">{t('billing.plansTitle')}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('billing.currentPlanMarked')} {VAT_DISCLAIMER}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('common:close')}
            onClick={onClose}
          >
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
                    {t('billing.currentPlanAction')}
                  </NeoButton>
                ) : plan.priceOnRequest ? (
                  <NeoButton variant="surface" size="sm" className="w-full" asChild>
                    <a href={`mailto:${RALLYHUB_CONTACT_EMAIL}?subject=Custom%20plan`}>
                      {t('billing.contactUs')}
                    </a>
                  </NeoButton>
                ) : (
                  // Self-serve switching is gated behind PLAN_CHANGES_ENABLED, so
                  // this points at the person who can do it rather than implying
                  // an upgrade path that is not wired up.
                  <NeoButton variant="surface" size="sm" className="w-full" asChild>
                    <a href={`mailto:${RALLYHUB_CONTACT_EMAIL}?subject=Switch%20to%20${encodeURIComponent(plan.name)}`}>
                      {t('billing.askToSwitch')}
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
