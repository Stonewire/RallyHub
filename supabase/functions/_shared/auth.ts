import { type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

export type AuthFailure = { ok: false; status: number; message: string }
export type AuthSuccess = { ok: true; user: User }

export async function requireAuthUser(
  supabaseAdmin: SupabaseClient,
  authHeader: string | null,
): Promise<AuthSuccess | AuthFailure> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Unauthorized' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, status: 401, message: 'Invalid session' }
  }

  return { ok: true, user: data.user }
}

/** client_admin of the org, or super_admin. */
export async function requireOrgAdminOrSuperAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<AuthFailure | { ok: true }> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }

  if (profile.role === 'super_admin') {
    return { ok: true }
  }

  if (profile.role === 'client_admin' && profile.organization_id === organizationId) {
    return { ok: true }
  }

  return { ok: false, status: 403, message: 'Forbidden' }
}

type OrgStaffRole = 'super_admin' | 'client_admin' | 'event_manager'

/** Org user management: client_admin, event_manager (facilitators only), or super_admin. */
export async function requireOrgUserManagerOrSuperAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<AuthFailure | { ok: true; role: OrgStaffRole }> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { ok: false, status: 403, message: 'Forbidden' }
  }

  if (profile.role === 'super_admin') {
    return { ok: true, role: 'super_admin' }
  }

  if (
    (profile.role === 'client_admin' || profile.role === 'event_manager') &&
    profile.organization_id === organizationId
  ) {
    return { ok: true, role: profile.role as OrgStaffRole }
  }

  return { ok: false, status: 403, message: 'Forbidden' }
}

export async function requireEventOrgAdminOrSuperAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<AuthFailure | { ok: true; organizationId: string }> {
  const { data: event, error } = await supabaseAdmin
    .from('events')
    .select('organization_id')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !event?.organization_id) {
    return { ok: false, status: 404, message: 'Event not found' }
  }

  const auth = await requireOrgAdminOrSuperAdmin(
    supabaseAdmin,
    userId,
    event.organization_id,
  )
  if (!auth.ok) return auth

  return { ok: true, organizationId: event.organization_id }
}
