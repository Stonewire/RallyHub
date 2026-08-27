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
import {
  eventHasDemoData,
  precheckEventActivation,
  resetEventData,
} from '@/lib/reset-event-data'
import type { EventStatus } from '@/types/database'
import { useOptionalTenant } from '@/contexts/tenant-context'

type PendingActivation = {
  eventId: string
  eventName: string
  teamCount: number
  /**
   * First activation with demo data present (P4.2): run resetEventData before
   * the status change, whatever the current status (a demo hopped through
   * ready or draft still carries demo leftovers). Only ever true for
   * never-activated events, so the reset guard (canResetEventData, billing
   * wall) is respected, not weakened.
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
  /** Org's custom_per_event_price_eur (P6.2): null = plan price, 0 = events included. */
  customPerEventPriceEur?: number | null
  onValidationError?: (msg: string) => void
}

export function useEventActivationFlow({
  billingPlan,
  organizationId,
  educationalStatus,
  customPerEventPriceEur = null,
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
        // TOCTOU guard: the probe answer was frozen when the dialog opened,
        // while the demo join link stayed claimable. Re-probe now: fresh data
        // means the clear must run even though the dialog did not warn about
        // it (wiping test data is exactly what this flow promises). On a
        // fresh-probe failure the dialog-time answer stands.
        let clearDemoData = pending.clearDemoData
        if (!clearDemoData && !pending.demoDataKept) {
          try {
            clearDemoData = await eventHasDemoData(pending.eventId)
          } catch {
            // keep the dialog-time answer
          }
        }
        // P4.2: a never-activated event with demo data is cleared BEFORE it
        // goes active, so the live event starts from a clean slate. The
        // entitlement gate normally only fires inside the status update, AFTER
        // the clear, so ask it first: a refused activation must abort here
        // with the demo data untouched. resetEventData then re-checks the
        // never-activated guard server-side; a failure there also aborts the
        // activation rather than going live on stale data.
        if (clearDemoData) {
          await precheckEventActivation(pending.eventId)
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
        // P4.2: probe for demo leftovers on EVERY first activation, whatever
        // the current status: claimed teams and submissions only ever arise
        // while an event is active or demo, so on a never-activated event
        // (billing required implies activated_at is null) they are demo
        // leftovers by definition, even after a hop through ready or draft.
        // Async, so the dialog opens with the probe already answered.
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
      // No billing dialog needed, but the change can still be refused by the
      // DB (entitlement gate on re-activation, constraints, RLS). Surface it
      // instead of letting the rejection vanish as an unhandled promise.
      void applyChange().catch((err: unknown) => {
        onValidationError?.(
          friendlyActivationError(err instanceof Error ? err.message : String(err)),
        )
      })
    },
    [onValidationError],
  )

  function ActivationDialog() {
    if (!pending) return null
    const warning = getEventActivationWarning(
      billingPlan,
      bestEventDiscount,
      isEducationalApproved(educationalStatus),
      pending.teamCount,
      customPerEventPriceEur,
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
