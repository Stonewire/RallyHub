import { useState } from 'react'

import { NeoButton, NeoLabel, NeoSelect } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  type SubscriptionChangePreview,
  usePaddleSubscriptionChange,
  usePaddleSubscriptionChangePreview,
} from '@/hooks/use-paddle-subscription'
import {
  formatSubscriptionPrice,
  getPlan,
  getSelfServePlans,
  type BillingPeriod,
  type PlanId,
} from '@/lib/subscription-plans'

type SubscriptionChangeFormProps = {
  organizationId: string
  currentPlanId: PlanId
  currentBillingPeriod: BillingPeriod
}

const CHANGEABLE_PLANS = getSelfServePlans().filter((plan) => !plan.freeSubscription)

function formatPaddleAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function SubscriptionChangeForm({
  organizationId,
  currentPlanId,
  currentBillingPeriod,
}: SubscriptionChangeFormProps) {
  const { notify } = useNotification()
  const [targetPlanId, setTargetPlanId] = useState<PlanId>(currentPlanId)
  const [targetPeriod, setTargetPeriod] = useState<BillingPeriod>(currentBillingPeriod)
  const [preview, setPreview] = useState<SubscriptionChangePreview | null>(null)
  const previewChange = usePaddleSubscriptionChangePreview(organizationId)
  const changeSubscription = usePaddleSubscriptionChange(organizationId)
  const targetPlan = getPlan(targetPlanId)
  const unchanged = targetPlanId === currentPlanId && targetPeriod === currentBillingPeriod

  function clearPreview() {
    setPreview(null)
    previewChange.reset()
  }

  async function handlePreview() {
    try {
      setPreview(await previewChange.mutateAsync({ planId: targetPlanId, billingPeriod: targetPeriod }))
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not preview the plan change.')
    }
  }

  async function handleConfirm() {
    try {
      await changeSubscription.mutateAsync({ planId: targetPlanId, billingPeriod: targetPeriod })
      setPreview(null)
      notify('Subscription changed successfully.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not change the subscription.')
    }
  }

  return (
    <Card className="border-border/80 space-y-4 bg-muted/20 p-4 shadow-none">
      <div>
        <p className="text-foreground text-sm font-medium">Change subscription</p>
        <p className="text-muted-foreground text-xs">
          Paddle calculates an exact prorated credit for unused time before anything changes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <NeoLabel htmlFor="subscription-change-plan">Plan</NeoLabel>
          <NeoSelect
            id="subscription-change-plan"
            value={targetPlanId}
            onChange={(event) => {
              setTargetPlanId(event.target.value as PlanId)
              clearPreview()
            }}
          >
            {CHANGEABLE_PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </NeoSelect>
        </div>
        <div className="space-y-1.5">
          <NeoLabel htmlFor="subscription-change-period">Billing</NeoLabel>
          <NeoSelect
            id="subscription-change-period"
            value={targetPeriod}
            onChange={(event) => {
              setTargetPeriod(event.target.value as BillingPeriod)
              clearPreview()
            }}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </NeoSelect>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        New recurring price: <span className="text-foreground font-medium">
          {formatSubscriptionPrice(targetPlan, targetPeriod)}
        </span>
      </p>

      {preview ? (
        <div className="border-border/80 space-y-2 rounded-md border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Due now, including tax and proration</span>
            <span className="text-foreground font-semibold tabular-nums">
              {formatPaddleAmount(preview.dueNow, preview.currency)}
            </span>
          </div>
          {preview.creditToBalance > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Credit added to Paddle balance</span>
              <span className="text-foreground font-medium tabular-nums">
                {formatPaddleAmount(preview.creditToBalance, preview.currency)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Normal renewal total</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatPaddleAmount(preview.recurringTotal, preview.currency)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            The change is applied only if Paddle successfully processes any amount due now.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <NeoButton
              variant="accent"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={changeSubscription.isPending}
            >
              {changeSubscription.isPending ? 'Changing…' : 'Confirm plan change'}
            </NeoButton>
            <NeoButton variant="surface" size="sm" onClick={clearPreview}>
              Cancel
            </NeoButton>
          </div>
        </div>
      ) : (
        <NeoButton
          variant="surface"
          size="sm"
          onClick={() => void handlePreview()}
          disabled={unchanged || previewChange.isPending}
        >
          {previewChange.isPending ? 'Calculating…' : unchanged ? 'Current subscription' : 'Review price change'}
        </NeoButton>
      )}
    </Card>
  )
}
