import { useCallback, useState } from 'react'

import { EventActivationConfirmDialog } from '@/components/events/EventActivationConfirmDialog'
import { getEventActivationWarning, isActivationBillingRequired } from '@/lib/event-activation-billing'
import { eventStatusTransitionError } from '@/lib/event-lifecycle'
import type { EventStatus } from '@/types/database'

type PendingActivation = {
  eventName: string
  onConfirm: () => Promise<void>
}

type UseEventActivationFlowOptions = {
  billingPlan: string | null | undefined
}

export function useEventActivationFlow({ billingPlan }: UseEventActivationFlowOptions) {
  const [pending, setPending] = useState<PendingActivation | null>(null)
  const [confirming, setConfirming] = useState(false)
  const warning = getEventActivationWarning(billingPlan)

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
        window.alert(transitionError)
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
