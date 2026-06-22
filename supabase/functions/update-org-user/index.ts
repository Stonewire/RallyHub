import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const ASSIGNABLE_ROLES = new Set(['facilitator', 'event_manager', 'client_admin'])

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
}

// Item 5: edit a team member. Authorization is decided server-side from the
// profiles table (never user_metadata, which is user-editable):
//   - editing yourself: any role, but you cannot change your own role
//   - editing someone else: client_admin (same org) or super_admin only
//   - role can only be changed by an org admin editing another user
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const auth = await requireAuthUser(admin, req.headers.get('Authorization'))
    if (!auth.ok) return json({ error: auth.message }, auth.status)

    const body = await req.json()
    const organizationId = body.organizationId?.trim()
    const targetUserId = (body.userId ?? body.user_id)?.trim()
    if (!organizationId || !targetUserId) {
      return json({ error: 'organizationId and userId are required' }, 400)
    }

    const { data: caller } = await admin
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', auth.user.id)
      .maybeSingle()
    if (!caller) return json({ error: 'Caller profile not found' }, 403)

    const { data: target } = await admin
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', targetUserId)
      .maybeSingle()
    if (!target || target.organization_id !== organizationId) {
      return json({ error: 'User is not a member of this organization' }, 404)
    }

    // Email lives on auth.users (not profiles); fetch the current one so we can
    // re-key the organization_members mirror if the email changes.
    const { data: targetAuth } = await admin.auth.admin.getUserById(targetUserId)
    const oldEmail = targetAuth.user?.email ?? null

    const isSelf = auth.user.id === targetUserId
    const callerIsOrgAdmin =
      caller.role === 'super_admin' ||
      (caller.role === 'client_admin' && caller.organization_id === organizationId)

    if (!isSelf && !callerIsOrgAdmin) {
      return json({ error: 'You can only edit your own details' }, 403)
    }

    // Parse fields
    const username = body.username ? normalizeUsername(body.username) : undefined
    const email = body.email?.trim().toLowerCase() || undefined
    const firstName = body.first_name?.trim() ?? body.firstName?.trim()
    const lastName = body.last_name?.trim() ?? body.lastName?.trim()
    const password = body.password
    const hasPassword = typeof password === 'string' && password.length > 0
    const requirePwChange = Boolean(body.require_password_change)
    const requestedRole = body.role?.trim()

    if (username && !USERNAME_PATTERN.test(username)) {
      return json({ error: 'Username must be 3–32 characters: letters, numbers, underscore only.' }, 400)
    }
    if (hasPassword && String(password).length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // Role changes: only an org admin editing another user may change a role.
    let applyRole: string | null = null
    if (requestedRole && ASSIGNABLE_ROLES.has(requestedRole)) {
      if (callerIsOrgAdmin && !isSelf && requestedRole !== target.role) {
        applyRole = requestedRole
      }
    }

    if (username) {
      const { data: clash } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', targetUserId)
        .maybeSingle()
      if (clash) return json({ error: 'Username is already taken' }, 400)
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

    // Auth admin update: email / password / metadata. must_change_password is
    // only touched when a new password is set (the "require update" tick).
    const authUpdate: Record<string, unknown> = {}
    if (email) authUpdate.email = email
    if (hasPassword) authUpdate.password = String(password)
    authUpdate.user_metadata = {
      ...(username ? { username } : {}),
      ...(firstName != null ? { first_name: firstName } : {}),
      ...(lastName != null ? { last_name: lastName } : {}),
      ...(fullName ? { full_name: fullName } : {}),
      ...(applyRole ? { role: applyRole } : {}),
      ...(hasPassword ? { must_change_password: requirePwChange } : {}),
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(targetUserId, authUpdate)
    if (authErr) return json({ error: authErr.message }, 400)

    // Profiles is the authoritative source for role + must_change_password.
    // (Email is NOT stored on profiles — it lives on auth.users, updated above.)
    const profileUpdate: Record<string, unknown> = {}
    if (username) profileUpdate.username = username
    if (firstName != null) profileUpdate.first_name = firstName
    if (lastName != null) profileUpdate.last_name = lastName
    if (fullName) profileUpdate.full_name = fullName
    if (applyRole) profileUpdate.role = applyRole
    if (hasPassword) profileUpdate.must_change_password = requirePwChange
    if (Object.keys(profileUpdate).length > 0) {
      await admin.from('profiles').update(profileUpdate).eq('id', targetUserId)
    }

    // Keep the organization_members mirror roughly in sync (best effort).
    await admin
      .from('organization_members')
      .update({
        ...(fullName ? { name: fullName } : {}),
        ...(email ? { email } : {}),
        ...(applyRole ? { role: applyRole } : {}),
      })
      .eq('organization_id', organizationId)
      .eq('email', oldEmail ?? '')

    return json({ ok: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Update user failed' }, 500)
  }
})
