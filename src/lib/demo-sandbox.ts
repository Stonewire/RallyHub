import { supabase } from '@/lib/supabase'
import type { BillingPeriod, PlanId } from '@/lib/subscription-plans'

export const DEMO_SUBDOMAIN = 'demo'
export const DEFAULT_DEMO_HOST = 'demo.rallyhub.games'

export type DemoSandboxState = {
  organizationId: string
  lastResetAt: string
  nextResetAt: string
  resetIntervalMinutes: number
  generation: number
}

export function isDemoHost(hostname?: string): boolean {
  if (typeof window === 'undefined' && !hostname) return false

  const host = (hostname ?? window.location.hostname).split(':')[0]?.toLowerCase() ?? ''
  const configuredHost =
    (import.meta.env.VITE_DEMO_HOST as string | undefined)?.trim().toLowerCase() ||
    DEFAULT_DEMO_HOST

  if (host === configuredHost || host === `${DEMO_SUBDOMAIN}.localhost`) return true

  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('tenant')?.toLowerCase() === DEMO_SUBDOMAIN
  }

  return false
}

export function formatDemoCountdown(milliseconds: number): string {
  const safe = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

async function functionError(error: unknown, fallback: string): Promise<Error> {
  try {
    const body = await (
      error as { context?: { json?: () => Promise<{ error?: string }> } }
    ).context?.json?.()
    if (body?.error) return new Error(body.error)
  } catch {
    // Keep the safe fallback below.
  }
  return new Error(fallback)
}

export async function enterDemoSandbox(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('demo-session', {
    body: { host: window.location.hostname },
  })
  if (error) throw await functionError(error, 'The demo is temporarily unavailable.')

  const tokenHash = (data as { tokenHash?: string } | null)?.tokenHash
  if (!tokenHash) throw new Error('The demo session could not be started.')

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  })
  if (verifyError) throw verifyError
}

export async function fetchDemoSandboxState(): Promise<DemoSandboxState> {
  const { data, error } = await supabase.functions.invoke('demo-reset', {
    body: { action: 'status' },
  })
  if (error) throw await functionError(error, 'Could not load the demo timer.')
  return data as DemoSandboxState
}

export async function resetDemoSandbox(force = true): Promise<DemoSandboxState> {
  const { data, error } = await supabase.functions.invoke('demo-reset', {
    body: { action: 'reset', force },
  })
  if (error) throw await functionError(error, 'Could not reset the demo.')
  return data as DemoSandboxState
}

export type DemoBillingRequest =
  | { kind: 'event'; invoiceId: string }
  | { kind: 'event_complete'; invoiceId: string; transactionId: string }
  | { kind: 'subscription'; planId: PlanId; billingPeriod: BillingPeriod }
  | {
      kind: 'subscription_complete'
      planId: PlanId
      billingPeriod: BillingPeriod
      transactionId: string
    }
  | {
      kind: 'subscription_change_preview'
      planId: PlanId
      billingPeriod: BillingPeriod
    }
  | {
      kind: 'subscription_change'
      planId: PlanId
      billingPeriod: BillingPeriod
    }

export async function demoBillingRequest<T>(
  organizationId: string,
  request: DemoBillingRequest,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('demo-billing', {
    body: { organizationId, ...request },
  })
  if (error) throw await functionError(error, 'The demo payment could not be completed.')
  return data as T
}
