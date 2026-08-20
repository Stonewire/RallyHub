import { i18n } from '@/lib/i18n'

import { supabase } from '@/lib/supabase'

export type OrganizationDeletionRequest = {
  organization_id: string
  requested_by: string | null
  requested_at: string
  scheduled_for: string
  paddle_cancellation_scheduled: boolean
  paddle_cancellation_error: string | null
}

export type CancelOrganizationDeletionResult = {
  restored: boolean
  restartSubscriptionRequired: boolean
  warning: string | null
}

async function lifecycleError(error: unknown, fallback: string): Promise<Error> {
  try {
    const body = await (
      error as { context?: { json?: () => Promise<{ error?: string }> } }
    ).context?.json?.()
    if (body?.error) return new Error(body.error)
  } catch {
    // Fall through to the user-facing fallback.
  }
  return new Error(fallback)
}

async function invokeLifecycle<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('data-lifecycle', { body })
  if (error) throw await lifecycleError(error, fallback)
  return data as T
}

export async function requestOrganizationDeletion(
  organizationId: string,
): Promise<{ request: OrganizationDeletionRequest; warning: string | null }> {
  return invokeLifecycle(
    { action: 'request_organization_deletion', organizationId },
    i18n.t('admin:settings.deletionRequestFailed'),
  )
}

export async function cancelOrganizationDeletion(
  organizationId: string,
): Promise<CancelOrganizationDeletionResult> {
  return invokeLifecycle(
    { action: 'cancel_organization_deletion', organizationId },
    i18n.t('admin:settings.restoreFailed'),
  )
}

export async function permanentlyDeleteEvent(eventId: string): Promise<void> {
  await invokeLifecycle(
    { action: 'purge_event', eventId },
    i18n.t('admin:events.purgeFailed'),
  )
}

// English on purpose: purging a client is a super-admin-only action, and the
// RallyHub platform surfaces are not translated.
export async function permanentlyDeleteOrganization(organizationId: string): Promise<void> {
  await invokeLifecycle(
    { action: 'purge_organization', organizationId },
    'Could not permanently delete the client.',
  )
}
