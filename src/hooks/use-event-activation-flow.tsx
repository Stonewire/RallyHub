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
import { autoChargeEventInvoice } from '@/lib/paddle'
import { queryKeys } from '@/lib/query-keys'
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
      try {
        await pending.onConfirm()
      } catch (err) {
        // The DB gate refused this activation (no subscription, plan limit hit,
        // an unsettled invoice, suspended). Without this catch the dialog would
        // just sit there with no explanation.
        setPending(null)
        onValidationError?.(
          friendlyActivationError(err instanceof Error ? err.message : String(err)),
        )
        return
      }
      setPending(null)

      // The event is live. Settle its invoice against a saved card if the org has
      // one; if not (Free plan, or nobody has subscribed yet) this quietly does
      // nothing and the invoice is paid manually with "Pay now".
      //
      // Strictly fire-and-forget: an unpaid invoice is recoverable, a disrupted
      // live event is not.
      if (organizationId) {
        void autoChargeEventInvoice(organizationId, pending.eventId).then(() => {
          void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId) })
        })
        void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId) })
      }
    } finally {
      setConfirming(false)
    }
  }, [pending, organizationId, qc, onValidationError])

  const requestStatusChange = useCallback(
    (
      eventId: string,
      currentStatus: EventStatus,
      nextStatus: EventStatus,
      eventName: string,
      activatedAt: string | null | undefined,
      applyChange: () => Promise<void>,
    ) => {
      const transitionError = eventStatusTransitionError(
        { status: currentStatus, activated_at: activatedAt ?? null },
        nextStatus,
      )
      if (transitionError) {
        onValidationError?.(transitionError)
        return
      }
      if (isActivationBillingRequired(currentStatus, nextStatus, activatedAt)) {
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
