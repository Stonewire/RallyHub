import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
import type { EventStatus } from '@/types/database'
import { useOptionalTenant } from '@/contexts/tenant-context'

type PendingActivation = {
  eventId: string
  eventName: string
  teamCount: number
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
  const isDemo = useOptionalTenant()?.tenantOrg?.is_demo === true
  const redemptionsQuery = useOrgPromoRedemptions(organizationId)
  const bestEventDiscount = (redemptionsQuery.data ?? [])
    .filter((r) => r.purpose === 'event' && r.status === 'active')
    .reduce((max, r) => Math.max(max, r.discount_percent), 0)
  const requestActivation = useCallback(
    (
      eventId: string,
      eventName: string,
      teamCount: number,
      onConfirm: () => Promise<void>,
    ) => {
      setPending({ eventId, eventName, teamCount, onConfirm })
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
      // one; if not (Pay Per Event, or nobody has subscribed yet) this quietly does
      // nothing and the invoice is paid manually with "Pay now".
      //
      // Strictly fire-and-forget: an unpaid invoice is recoverable, a disrupted
      // live event is not.
      if (organizationId) {
        void autoChargeEventInvoice(organizationId, pending.eventId, isDemo).then(() => {
          void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId) })
        })
        void qc.invalidateQueries({ queryKey: queryKeys.organizationInvoices(organizationId) })
      }
    } finally {
      setConfirming(false)
    }
  }, [pending, organizationId, qc, onValidationError, isDemo])

  const requestStatusChange = useCallback(
    (
      eventId: string,
      currentStatus: EventStatus,
      nextStatus: EventStatus,
      eventName: string,
      teamCount: number,
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
        requestActivation(eventId, eventName, teamCount, applyChange)
        return
      }
      void applyChange()
    },
    [requestActivation, onValidationError],
  )

  function ActivationDialog() {
    if (!pending) return null
    const warning = getEventActivationWarning(
      billingPlan,
      bestEventDiscount,
      isEducationalApproved(educationalStatus),
      pending.teamCount,
    )
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
