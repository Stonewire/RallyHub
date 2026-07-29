import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

import {
  requireAuthUser,
  requireEventOrgAdminOrSuperAdmin,
  requireOrgAdminOrSuperAdmin,
} from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-data-lifecycle-secret',
}

const PAGE_SIZE = 1000
const DELETE_BATCH_SIZE = 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

type AdminClient = SupabaseClient
type StorageBucket = 'game-assets' | 'organization-logos'
type CleanupJob = {
  job_id: string
  target_type: 'event' | 'organization'
  target_id: string
  reason: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function publicStoragePath(urlValue: string | null, bucket: StorageBucket): string | null {
  if (!urlValue) return null
  try {
    const url = new URL(urlValue)
    const marker = `/storage/v1/object/public/${bucket}/`
    const index = url.pathname.indexOf(marker)
    if (index < 0) return null
    return decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

async function listFolder(
  admin: AdminClient,
  bucket: StorageBucket,
  prefix: string,
): Promise<Array<{ name: string; id?: string | null; metadata?: unknown }>> {
  const all: Array<{ name: string; id?: string | null; metadata?: unknown }> = []
  let offset = 0
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Could not list ${bucket}/${prefix}: ${error.message}`)
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

async function collectPrefixPaths(
  admin: AdminClient,
  bucket: StorageBucket,
  rootPrefix: string,
): Promise<string[]> {
  const files: string[] = []
  const folders = [rootPrefix.replace(/^\/+|\/+$/g, '')]

  while (folders.length > 0) {
    const prefix = folders.shift()!
    const entries = await listFolder(admin, bucket, prefix)
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Storage returns virtual folders without an object id/metadata.
      if (entry.id || entry.metadata) files.push(path)
      else folders.push(path)
    }
  }

  return files
}

async function removePaths(
  admin: AdminClient,
  bucket: StorageBucket,
  paths: string[],
): Promise<number> {
  const unique = [...new Set(paths.filter(Boolean))]
  for (const batch of chunks(unique, DELETE_BATCH_SIZE)) {
    const { error } = await admin.storage.from(bucket).remove(batch)
    if (error) throw new Error(`Could not delete ${bucket} objects: ${error.message}`)
  }
  return unique.length
}

async function removePrefix(
  admin: AdminClient,
  bucket: StorageBucket,
  prefix: string,
): Promise<number> {
  let removed = 0
  // Repeat to catch an upload that finished while the first listing was in flight.
  for (let pass = 0; pass < 3; pass += 1) {
    const paths = await collectPrefixPaths(admin, bucket, prefix)
    if (paths.length === 0) return removed
    removed += await removePaths(admin, bucket, paths)
  }

  const remaining = await collectPrefixPaths(admin, bucket, prefix)
  if (remaining.length > 0) {
    throw new Error(`${remaining.length} object(s) remained under ${bucket}/${prefix}`)
  }
  return removed
}

async function fetchAllEventIds(admin: AdminClient, organizationId: string): Promise<string[]> {
  const ids: string[] = []
  let from = 0
  while (true) {
    const { data, error } = await admin
      .from('events')
      .select('id')
      .eq('organization_id', organizationId)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    ids.push(...page.map((row: { id: string }) => row.id))
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return ids
}

async function fetchOrganizationUsers(
  admin: AdminClient,
  organizationId: string,
): Promise<Array<{ id: string; role: string }>> {
  const users: Array<{ id: string; role: string }> = []
  let from = 0
  while (true) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, role')
      .eq('organization_id', organizationId)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    users.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return users
}

function paddleBaseUrl(): string {
  return Deno.env.get('PADDLE_ENVIRONMENT') === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com'
}

async function getPaddleSubscription(subscriptionId: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('PADDLE_API_KEY')
  if (!apiKey) throw new Error('Paddle is not configured for subscription cancellation.')
  const response = await fetch(`${paddleBaseUrl()}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) {
    throw new Error(`Paddle subscription lookup failed (${response.status}).`)
  }
  return (await response.json()).data as Record<string, unknown>
}

async function schedulePaddleCancellation(subscriptionId: string): Promise<void> {
  const apiKey = Deno.env.get('PADDLE_API_KEY')
  if (!apiKey) throw new Error('Paddle is not configured for subscription cancellation.')
  const subscription = await getPaddleSubscription(subscriptionId)
  if (subscription.status === 'canceled') return
  const scheduled = subscription.scheduled_change as { action?: string } | null
  if (scheduled?.action === 'cancel') return

  const response = await fetch(
    `${paddleBaseUrl()}/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ effective_from: 'next_billing_period' }),
    },
  )
  if (!response.ok) {
    console.error('[data-lifecycle] Paddle scheduled cancellation failed:', response.status)
    throw new Error('Paddle could not schedule the subscription cancellation.')
  }
}

async function undoPaddleCancellation(
  subscriptionId: string,
): Promise<{ restartRequired: boolean }> {
  const apiKey = Deno.env.get('PADDLE_API_KEY')
  if (!apiKey) throw new Error('Paddle is not configured for subscription restoration.')
  const subscription = await getPaddleSubscription(subscriptionId)
  if (subscription.status === 'canceled') return { restartRequired: true }
  const scheduled = subscription.scheduled_change as { action?: string } | null
  if (scheduled?.action !== 'cancel') return { restartRequired: false }

  const response = await fetch(`${paddleBaseUrl()}/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scheduled_change: null }),
  })
  if (!response.ok) {
    console.error('[data-lifecycle] Paddle cancellation undo failed:', response.status)
    throw new Error('Paddle could not restore automatic subscription renewal.')
  }
  return { restartRequired: false }
}

async function cancelPaddleImmediately(subscriptionId: string): Promise<void> {
  const apiKey = Deno.env.get('PADDLE_API_KEY')
  if (!apiKey) throw new Error('Paddle is not configured for subscription cancellation.')
  let subscription = await getPaddleSubscription(subscriptionId)
  if (subscription.status === 'canceled') return

  const scheduled = subscription.scheduled_change as { action?: string } | null
  if (scheduled) {
    const clearResponse = await fetch(`${paddleBaseUrl()}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduled_change: null }),
    })
    if (!clearResponse.ok) {
      throw new Error('Paddle could not clear the pending subscription change.')
    }
    subscription = (await clearResponse.json()).data as Record<string, unknown>
  }

  if (subscription.status === 'canceled') return
  const response = await fetch(
    `${paddleBaseUrl()}/subscriptions/${subscriptionId}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ effective_from: 'immediately' }),
    },
  )
  if (!response.ok) {
    console.error('[data-lifecycle] Paddle immediate cancellation failed:', response.status)
    throw new Error('Paddle could not cancel the subscription before account deletion.')
  }
}

async function isSuperAdmin(admin: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role === 'super_admin'
}

async function purgeEvent(
  admin: AdminClient,
  eventId: string,
  jobId: string | null,
): Promise<{ removedObjects: number; missing?: boolean }> {
  const { data: event, error } = await admin
    .from('events')
    .select('id, organization_id, branding_enabled, logo_url')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  if (!event) {
    if (jobId) await admin.rpc('complete_data_cleanup_job', { p_job_id: jobId })
    return { removedObjects: 0, missing: true }
  }

  let removedObjects = await removePrefix(admin, 'game-assets', eventId)

  // Event-specific branding lives under the org's /events folder. Only remove
  // the exact row URL and only when custom branding was enabled; inherited org
  // logos are shared and must survive an event deletion.
  if (event.branding_enabled) {
    const logoPath = publicStoragePath(event.logo_url, 'organization-logos')
    if (logoPath?.startsWith(`${event.organization_id}/events/`)) {
      const { data: anotherReference, error: referenceError } = await admin
        .from('events')
        .select('id')
        .eq('logo_url', event.logo_url)
        .neq('id', eventId)
        .limit(1)
        .maybeSingle()
      if (referenceError) throw referenceError
      if (!anotherReference) {
        const logoSegments = logoPath.split('/').filter(Boolean)
        if (logoSegments.length >= 4) {
          // New event logos are grouped under
          // <org>/events/<event-or-form-key>/ so superseded uploads disappear
          // too. Legacy logos used <org>/events/<file>; remove only that exact
          // object to avoid touching another event's branding.
          removedObjects += await removePrefix(
            admin,
            'organization-logos',
            logoSegments.slice(0, -1).join('/'),
          )
        } else {
          removedObjects += await removePaths(admin, 'organization-logos', [logoPath])
        }
      }
    }
  }

  const { error: finalizeError } = await admin.rpc('finalize_event_data_cleanup', {
    p_event_id: eventId,
    p_job_id: jobId,
  })
  if (finalizeError) throw finalizeError
  return { removedObjects }
}

async function purgeOrganization(
  admin: AdminClient,
  organizationId: string,
  jobId: string | null,
): Promise<{ removedObjects: number; removedUsers: number; missing?: boolean }> {
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, paddle_subscription_id, is_demo')
    .eq('id', organizationId)
    .maybeSingle()
  if (orgError) throw orgError
  if (!org) {
    if (jobId) await admin.rpc('complete_data_cleanup_job', { p_job_id: jobId })
    return { removedObjects: 0, removedUsers: 0, missing: true }
  }
  if (org.is_demo) {
    throw new Error('The public demo organization cannot be deleted.')
  }

  const users = await fetchOrganizationUsers(admin, organizationId)
  if (users.some((user) => user.role === 'super_admin')) {
    throw new Error('The RallyHub platform organization cannot be deleted.')
  }

  // Stop billing before destructive cleanup. If this fails, data stays intact
  // and the queued job retries instead of deleting a paid account incompletely.
  if (org.paddle_subscription_id) {
    await cancelPaddleImmediately(org.paddle_subscription_id)
  }

  const eventIds = await fetchAllEventIds(admin, organizationId)
  let removedObjects = 0
  for (const eventId of eventIds) {
    removedObjects += await removePrefix(admin, 'game-assets', eventId)
  }
  removedObjects += await removePrefix(admin, 'game-assets', organizationId)
  removedObjects += await removePrefix(admin, 'organization-logos', organizationId)

  // Auth deletion is intentionally after Storage cleanup: Supabase refuses to
  // delete an Auth user who still owns Storage objects.
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id, false)
    if (error) throw new Error(`Could not delete organization user: ${error.message}`)
  }

  const { error: deleteError } = await admin
    .from('organizations')
    .delete()
    .eq('id', organizationId)
  if (deleteError) throw deleteError

  if (jobId) {
    const { error } = await admin.rpc('complete_data_cleanup_job', { p_job_id: jobId })
    if (error) throw error
  }
  return { removedObjects, removedUsers: users.length }
}

async function requestOrganizationDeletion(
  admin: AdminClient,
  userId: string,
  organizationId: string,
) {
  const auth = await requireOrgAdminOrSuperAdmin(admin, userId, organizationId)
  if (!auth.ok) throw new Error(auth.message)

  const users = await fetchOrganizationUsers(admin, organizationId)
  if (users.some((user) => user.role === 'super_admin')) {
    throw new Error('The RallyHub platform organization cannot be deleted.')
  }

  const { data: existing } = await admin
    .from('organization_deletion_requests')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (existing) return { request: existing, warning: null }

  const requestedAt = new Date()
  const scheduledFor = new Date(requestedAt.getTime() + THIRTY_DAYS_MS)
  const { data: request, error: requestError } = await admin
    .from('organization_deletion_requests')
    .insert({
      organization_id: organizationId,
      requested_by: userId,
      requested_at: requestedAt.toISOString(),
      scheduled_for: scheduledFor.toISOString(),
    })
    .select('*')
    .single()
  if (requestError) throw requestError

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('paddle_subscription_id, is_demo')
    .eq('id', organizationId)
    .single()
  if (orgError) throw orgError
  if (org.is_demo) throw new Error('The public demo organization cannot be deleted.')

  let warning: string | null = null
  if (org.paddle_subscription_id) {
    try {
      await schedulePaddleCancellation(org.paddle_subscription_id)
      await admin
        .from('organization_deletion_requests')
        .update({ paddle_cancellation_scheduled: true, paddle_cancellation_error: null })
        .eq('organization_id', organizationId)
    } catch (error) {
      warning = errorMessage(error)
      await admin
        .from('organization_deletion_requests')
        .update({ paddle_cancellation_error: warning })
        .eq('organization_id', organizationId)
    }
  }

  return { request, warning }
}

async function cancelOrganizationDeletion(
  admin: AdminClient,
  userId: string,
  organizationId: string,
) {
  const auth = await requireOrgAdminOrSuperAdmin(admin, userId, organizationId)
  if (!auth.ok) throw new Error(auth.message)

  const { data: request, error: requestError } = await admin
    .from('organization_deletion_requests')
    .select('organization_id')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (requestError) throw requestError
  if (!request) return { restored: true, restartSubscriptionRequired: false, warning: null }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('paddle_subscription_id')
    .eq('id', organizationId)
    .single()
  if (orgError) throw orgError

  let restartSubscriptionRequired = false
  let warning: string | null = null
  if (org.paddle_subscription_id) {
    try {
      const result = await undoPaddleCancellation(org.paddle_subscription_id)
      restartSubscriptionRequired = result.restartRequired
    } catch (error) {
      warning = errorMessage(error)
    }
  }

  // Account restoration is never blocked by a Paddle outage. If the scheduled
  // change could not be undone, the UI tells the client to check Billing.
  const { error: deleteError } = await admin
    .from('organization_deletion_requests')
    .delete()
    .eq('organization_id', organizationId)
  if (deleteError) throw deleteError

  return { restored: true, restartSubscriptionRequired, warning }
}

async function retryPendingPaddleCancellations(admin: AdminClient): Promise<void> {
  const { data: requests, error } = await admin
    .from('organization_deletion_requests')
    .select('organization_id')
    .eq('paddle_cancellation_scheduled', false)
    .limit(20)
  if (error) throw error

  for (const request of requests ?? []) {
    const { data: org } = await admin
      .from('organizations')
      .select('paddle_subscription_id')
      .eq('id', request.organization_id)
      .maybeSingle()
    if (!org?.paddle_subscription_id) {
      await admin
        .from('organization_deletion_requests')
        .update({ paddle_cancellation_scheduled: true, paddle_cancellation_error: null })
        .eq('organization_id', request.organization_id)
      continue
    }
    try {
      await schedulePaddleCancellation(org.paddle_subscription_id)
      await admin
        .from('organization_deletion_requests')
        .update({ paddle_cancellation_scheduled: true, paddle_cancellation_error: null })
        .eq('organization_id', request.organization_id)
    } catch (retryError) {
      await admin
        .from('organization_deletion_requests')
        .update({ paddle_cancellation_error: errorMessage(retryError) })
        .eq('organization_id', request.organization_id)
    }
  }
}

async function runScheduledCleanup(admin: AdminClient) {
  await retryPendingPaddleCancellations(admin)

  const { data, error } = await admin.rpc('claim_data_cleanup_jobs', { p_limit: 10 })
  if (error) throw error
  const jobs = (data ?? []) as CleanupJob[]
  const results: Array<Record<string, unknown>> = []

  for (const job of jobs) {
    try {
      if (job.target_type === 'event') {
        const { data: event, error: eventError } = await admin
          .from('events')
          .select('deleted_at')
          .eq('id', job.target_id)
          .maybeSingle()
        if (eventError) throw eventError
        if (!event) {
          await admin.rpc('complete_data_cleanup_job', { p_job_id: job.job_id })
          results.push({ jobId: job.job_id, status: 'already_removed' })
          continue
        }

        const stillDue = job.reason !== 'event_bin' || Boolean(
          event.deleted_at &&
            new Date(event.deleted_at).getTime() + THIRTY_DAYS_MS <= Date.now(),
        )
        if (!stillDue) {
          await admin.rpc('complete_data_cleanup_job', { p_job_id: job.job_id })
          results.push({ jobId: job.job_id, status: 'no_longer_due' })
          continue
        }

        const result = await purgeEvent(admin, job.target_id, job.job_id)
        results.push({ jobId: job.job_id, status: 'completed', ...result })
      } else {
        const { data: request } = await admin
          .from('organization_deletion_requests')
          .select('scheduled_for')
          .eq('organization_id', job.target_id)
          .maybeSingle()
        if (!request || new Date(request.scheduled_for).getTime() > Date.now()) {
          await admin.rpc('complete_data_cleanup_job', { p_job_id: job.job_id })
          results.push({ jobId: job.job_id, status: 'canceled' })
          continue
        }
        const result = await purgeOrganization(admin, job.target_id, job.job_id)
        results.push({ jobId: job.job_id, status: 'completed', ...result })
      }
    } catch (jobError) {
      const message = errorMessage(jobError)
      console.error('[data-lifecycle] cleanup job failed:', job.job_id, message)
      await admin.rpc('fail_data_cleanup_job', {
        p_job_id: job.job_id,
        p_error: message,
      })
      results.push({ jobId: job.job_id, status: 'failed', error: message })
    }
  }

  return { claimed: jobs.length, results }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfiguration' }, 500)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    })
    const body = await req.json().catch(() => ({}))
    const action = body.action

    if (action === 'run_scheduled_cleanup') {
      const expected = Deno.env.get('DATA_LIFECYCLE_CRON_SECRET')
      const received = req.headers.get('x-data-lifecycle-secret')
      if (!expected || !received || received !== expected) {
        return json({ error: 'Unauthorized' }, 401)
      }
      return json(await runScheduledCleanup(admin))
    }

    const auth = await requireAuthUser(admin, req.headers.get('Authorization'))
    if (!auth.ok) return json({ error: auth.message }, auth.status)

    const organizationId = typeof body.organizationId === 'string'
      ? body.organizationId.trim()
      : ''

    if (action === 'request_organization_deletion') {
      if (!organizationId) return json({ error: 'organizationId is required' }, 400)
      return json(await requestOrganizationDeletion(admin, auth.user.id, organizationId))
    }

    if (action === 'cancel_organization_deletion') {
      if (!organizationId) return json({ error: 'organizationId is required' }, 400)
      return json(await cancelOrganizationDeletion(admin, auth.user.id, organizationId))
    }

    if (action === 'purge_event') {
      const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : ''
      if (!eventId) return json({ error: 'eventId is required' }, 400)
      const eventAuth = await requireEventOrgAdminOrSuperAdmin(admin, auth.user.id, eventId)
      if (!eventAuth.ok) return json({ error: eventAuth.message }, eventAuth.status)
      const { data: event } = await admin
        .from('events')
        .select('deleted_at')
        .eq('id', eventId)
        .maybeSingle()
      if (!event?.deleted_at) {
        return json({ error: 'Move the event to the Bin before deleting it permanently.' }, 400)
      }
      return json(await purgeEvent(admin, eventId, null))
    }

    if (action === 'purge_organization') {
      if (!organizationId) return json({ error: 'organizationId is required' }, 400)
      if (!(await isSuperAdmin(admin, auth.user.id))) {
        return json({ error: 'Forbidden' }, 403)
      }
      return json(await purgeOrganization(admin, organizationId, null))
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('[data-lifecycle] unexpected error:', error)
    return json({ error: errorMessage(error) }, 500)
  }
})
