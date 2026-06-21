import { useCallback, useState } from 'react'

import { EventActivationConfirmDialog } from '@/components/events/EventActivationConfirmDialog'
import { getEventActivationWarning, isActivationBillingRequired } from '@/lib/event-activation-billing'
import { isEducationalApproved } from '@/lib/educational'
import { eventStatusTransitionError } from '@/lib/event-lifecycle'
import { useOrgPromoRedemptions } from '@/hooks/use-promo-codes'
import type { EventStatus } from '@/types/database'

type PendingActivation = {
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
  const redemptionsQuery = useOrgPromoRedemptions(organizationId)
  const bestEventDiscount = (redemptionsQuery.data ?? [])
    .filter((r) => r.purpose === 'event' && r.status === 'active')
    .reduce((max, r) => Math.max(max, r.discount_percent), 0)
  const warning = getEventActivationWarning(
    billingPlan,
    bestEventDiscount,
    isEducationalApproved(educationalStatus),
  )

  const requestActivation = useCallback(
    (eventName: string, onConfirm: () => Promise<void>) => {
      setPending({ eventName, onConfirm })
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
      await pending.onConfirm()
      setPending(null)
    } finally {
      setConfirming(false)
    }
  }, [pending])

  const requestStatusChange = useCallback(
    (
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
        requestActivation(eventName, applyChange)
        return
      }
      void applyChange()
    },
    [requestActivation],
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
