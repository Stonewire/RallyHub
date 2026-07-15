import { useMutation, useQueryClient } from '@tanstack/react-query'

import { payWithPaddle } from '@/lib/paddle'
import { queryKeys } from '@/lib/query-keys'
import type { BillingPeriod, PlanId } from '@/lib/subscription-plans'
import { supabase } from '@/lib/supabase'

/**
 * Starts paying for a plan via Paddle: creates a transaction for the plan's
 * price (server computes the amount, applying the educational discount if
 * approved), opens the overlay checkout, and on completion refetches the
 * organization so the new plan/paddle_subscription_id show up. The webhook
 * remains the source of truth for actually activating the subscription; this
 * refetch is just for prompt UI feedback.
 *
 * Only for organizations without an existing paddle_subscription_id — this
 * does not support changing an active subscription's plan yet.
 */
export function usePaddleSubscriptionCheckout(organizationId: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: BillingPeriod }) => {
      if (!organizationId) throw new Error('No organization selected.')
      const { data, error } = await supabase.functions.invoke('paddle-checkout', {
        body: { organizationId, kind: 'subscription', planId, billingPeriod },
      })
      if (error) {
        let msg = 'Could not start checkout. Please try again.'
        try {
          const errBody = await (
            error as { context?: { json?: () => Promise<{ error?: string }> } }
          ).context?.json?.()
          if (errBody?.error) msg = errBody.error
        } catch {
          /* ignore — fall back to the generic message */
        }
        throw new Error(msg)
      }
      const transactionId = (data as { transactionId?: string } | null)?.transactionId
      if (!transactionId) throw new Error('Checkout could not be started.')
      return payWithPaddle(transactionId)
    },
    onSuccess: (result) => {
      if (result === 'completed') {
        void qc.invalidateQueries({ queryKey: queryKeys.organization(organizationId ?? null) })
        // Also covers the super-admin client-detail view, which uses its own key.
        void qc.invalidateQueries({ queryKey: ['rallyhub', 'client', organizationId ?? undefined] })
      }
    },
  })
}

export type SubscriptionChangePreview = {
  planId: PlanId
  billingPeriod: BillingPeriod
  dueNow: number
  creditToBalance: number
  recurringTotal: number
  currency: string
  nextBilledAt: string | null
}

async function subscriptionChangeRequest<T>(
  organizationId: string | null | undefined,
  kind: 'subscription_change_preview' | 'subscription_change',
  planId: PlanId,
  billingPeriod: BillingPeriod,
): Promise<T> {
  if (!organizationId) throw new Error('No organization selected.')
  const { data, error } = await supabase.functions.invoke('paddle-checkout', {
    body: { organizationId, kind, planId, billingPeriod },
  })
  if (error) {
    let message = 'Could not change the subscription. Please try again.'
    try {
      const errBody = await (
        error as { context?: { json?: () => Promise<{ error?: string }> } }
      ).context?.json?.()
      if (errBody?.error) message = errBody.error
    } catch {
      /* keep the customer-safe fallback */
    }
    throw new Error(message)
  }
  return data as T
}

export function usePaddleSubscriptionChangePreview(
  organizationId: string | null | undefined,
) {
  return useMutation({
    mutationFn: ({ planId, billingPeriod }: { planId: PlanId; billingPeriod: BillingPeriod }) =>
      subscriptionChangeRequest<SubscriptionChangePreview>(
        organizationId,
        'subscription_change_preview',
        planId,
        billingPeriod,
      ),
  })
}

export function usePaddleSubscriptionChange(
  organizationId: string | null | undefined,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, billingPeriod }: { planId: PlanId; billingPeriod: BillingPeriod }) =>
      subscriptionChangeRequest<{ changed: true; planId: PlanId; billingPeriod: BillingPeriod }>(
        organizationId,
        'subscription_change',
        planId,
        billingPeriod,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.organization(organizationId ?? null) })
      void qc.invalidateQueries({ queryKey: ['rallyhub', 'client', organizationId ?? undefined] })
    },
  })
}
