import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { EventActivationConfirmDialog } from '@/components/events/EventActivationConfirmDialog'
import {
  friendlyActivationError,
  getEventActivationWarning,
  isActivationBillingRequired,
} from '@/lib/event-activation-billing'
import { isEducationalApproved } from '@/lib/educational'
import { eventStatusTransitionError } from '@/lib/event-lifecycle'
import { useOrgPromoRedemptions } from '@/hooks/use-promo-codes'
import { autoChargeEventInvoice, prepayEventInvoice } from '@/lib/paddle'
import { queryKeys } from '@/lib/query-keys'
import { normalizePlanId } from '@/lib/subscription-plans'
import { supabase } from '@/lib/supabase'
import type { EventStatus } from '@/types/database'

type PendingActivation = {
  eventId: string
  eventName: string
  onConfirm: () => Promise<void>
}

type UseEventActivationFlowOptions = {
  billingPlan: string | null | undefined
  organizationId?: string | null
  /** Org's educational_status — approved unlocks the 50% per-event discount. */
  educationalStatus?: string | null
  onValidationError?: (msg: string) => void
}

export function useEventActivationFlow({
  billingPlan,
  organizationId,
  educationalStatus,
  onValidationError,
}: UseEventActivationFlowOptions) {
  const [pending, setPending] = useState<PendingActivation | null>(null)
  const [confirming, setConfirming] = useState(false)
  const qc = useQueryClient()
  const redemptionsQuery = useOrgPromoRedemptions(organizationId)
  const bestEventDiscount = (redemptionsQuery.data ?? [])
    .filter((r) => r.purpose === 'event' && r.status === 'active')
    .reduce((max, r) => Math.max(max, r.discount_percent), 0)
  // First event = the org has never been invoiced for one. Mirrors the
  // create_event_activation_invoice DB check (the current event isn't invoiced
  // until activation, so an invoice count of 0 means this is the first).
  const invoiceCountQuery = useQuery({
    queryKey: ['org-invoice-count', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId!)
      if (error) throw error
      return count ?? 0
    },
  })
  const isFirstEvent = invoiceCountQuery.data === 0
  const warning = getEventActivationWarning(
    billingPlan,
    bestEventDiscount,
    isEducationalApproved(educationalStatus),
    isFirstEvent,
  )

  const requestActivation = useCallback(
    (eventId: string, eventName: string, onConfirm: () => Promise<void>) => {
      setPending({ eventId, eventName, onConfirm })
    },
    [],
  )

  const cancelActivation = useCallback(() => {
    if (confirming) return
    setPending(null)
  }, [confirming])

  const confirmActivation = useCallback(async () => {
    if (!pending) return
    setConfirming(true)
    try {
      const planId = normalizePlanId(billingPlan)
      const isFreePlan = planId === 'rookie'

      // Free plan has no subscription and no saved card, so the fee is collected
      // BEFORE going live — the DB gate refuses to activate an unpaid Free event.
      // A 100%-off promo comes back settled with no checkout shown.
      if (isFreePlan && organizationId) {
        const result = await prepayEventInvoice(organizationId, pending.eventId)
        if (!result.ok) {
          setPending(null)
          // 'closed' = they dismissed the checkout themselves; not an error.
          if (result.reason !== 'closed') {
            // prepare_event_invoice runs the other gates too, so this can be a
            // limit/suspension error rather than a payment one.
            onValidationError?.(
              result.message
                ? friendlyActivationError(result.message)
                : 'Payment was not completed, so the event was not activated.',
            )
          }
          return
        }
      }

      try {
        await pending.onConfirm()
      } catch (err) {
        // The DB gate refused this activation (no subscription, plan limit hit,
        // unpaid, suspended). Without this catch the dialog would just sit there
        // with no explanation.
        setPending(null)
        onValidationError?.(
          friendlyActivationError(err instanceof Error ? err.message : String(err)),
        )
        return
      }
      setPending(null)

      // Paid plans: settle the per-event fee against the card saved with their
      // subscription. Strictly fire-and-forget — the event is already live, and
      // an unpaid invoice is recoverable where a disrupted event is not.
      if (!isFreePlan && organizationId) {
        void autoChargeEventInvoice(organizationId, pending.eventId).then(() => {
          void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId) })
        })
      }
      if (organizationId) {
        void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId) })
      }
    } finally {
      setConfirming(false)
    }
  }, [pending, organizationId, billingPlan, qc, onValidationError])

  const requestStatusChange = useCallback(
    (
      eventId: string,
      currentStatus: EventStatus,
      nextStatus: EventStatus,
      eventName: string,
      invoicedAt: string | null | undefined,
      applyChange: () => Promise<void>,
    ) => {
      const transitionError = eventStatusTransitionError(
        { status: currentStatus, invoiced_at: invoicedAt ?? null },
        nextStatus,
      )
      if (transitionError) {
        onValidationError?.(transitionError)
        return
      }
      if (isActivationBillingRequired(currentStatus, nextStatus, invoicedAt)) {
        requestActivation(eventId, eventName, applyChange)
        return
      }
      void applyChange()
    },
    [requestActivation, onValidationError],
  )

  function ActivationDialog() {
    if (!pending) return null
    return (
      <EventActivationConfirmDialog
        eventName={pending.eventName}
        warning={warning}
        confirming={confirming}
        onCancel={cancelActivation}
        onConfirm={() => void confirmActivation()}
      />
    )
  }

  return {
    requestActivation,
    requestStatusChange,
    cancelActivation,
    confirmActivation,
    pendingActivation: pending,
    confirmingActivation: confirming,
    ActivationDialog,
  }
}
