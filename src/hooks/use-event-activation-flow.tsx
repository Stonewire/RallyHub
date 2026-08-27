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
import { i18n } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { eventHasDemoData, resetEventData } from '@/lib/reset-event-data'
import type { EventStatus } from '@/types/database'
import { useOptionalTenant } from '@/contexts/tenant-context'

type PendingActivation = {
  eventId: string
  eventName: string
  teamCount: number
  /**
   * Demo to active with demo data present (P4.2): run resetEventData before
   * the status change. Only ever true for never-activated events, so the
   * reset guard (canResetEventData, billing wall) is respected, not weakened.
   */
  clearDemoData: boolean
  /**
   * Defensive branch of the same rule: demo data exists but the event was
   * activated before, so the clear is skipped and the dialog says so.
   */
  demoDataKept: boolean
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
      setPending({
        eventId,
        eventName,
        teamCount,
        clearDemoData: false,
        demoDataKept: false,
        onConfirm,
      })
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
        // P4.2: a demo event with demo data is cleared BEFORE it goes active,
        // so the live event starts from a clean slate. resetEventData
        // re-checks the never-activated guard server-side; a failure here
        // aborts the activation rather than going live on stale data.
        if (pending.clearDemoData) {
          await resetEventData(pending.eventId)
        }
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
        if (currentStatus === 'demo') {
          // P4.2: probe for demo leftovers (claimed teams, submissions) so the
          // billing dialog can warn that activation clears them first. Async,
          // so the dialog opens with the probe already answered.
          void (async () => {
            let hasDemoData = true
            try {
              hasDemoData = await eventHasDemoData(eventId)
            } catch {
              // Probe failure: warn and clear anyway. Resetting an event with
              // no data is harmless; going live on stale demo data is not.
            }
            setPending({
              eventId,
              eventName,
              teamCount,
              clearDemoData: hasDemoData && !activatedAt,
              demoDataKept: hasDemoData && Boolean(activatedAt),
              onConfirm: applyChange,
            })
          })()
          return
        }
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
    // Resolved at render like getEventActivationWarning, so the note follows
    // the admin language without the hook needing its own translation state.
    const demoDataNotice = pending.clearDemoData
      ? i18n.t('admin:events.activate.demoClearNote')
      : pending.demoDataKept
        ? i18n.t('admin:events.activate.demoKeptNote')
        : null
    return (
      <EventActivationConfirmDialog
        eventName={pending.eventName}
        warning={warning}
        demoDataNotice={demoDataNotice}
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
