import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

const STAFF_ROLES = new Set(['platform_admin', 'support_agent', 'content_manager', 'finance'])
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Internal RallyHub staff management. Owner-only: every action verifies the
 * caller is a super_admin whose staff_role is owner before touching anything.
 *
 * Staff accounts are super_admin at the auth layer (so platform policies keep
 * working) with a staff_role that the panel and the DB guards scope. The
 * 'owner' staff_role can never be assigned here, so there is exactly one tier
 * that can run this function.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    // Inline auth (no shared import, so the function deploys standalone).
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const { data: authData, error: authError } = await admin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)
    const authUserId = authData.user.id

    const { data: caller } = await admin
      .from('profiles')
      .select('role, staff_role')
      .eq('id', authUserId)
      .maybeSingle()
    if (caller?.role !== 'super_admin' || (caller.staff_role ?? 'owner') !== 'owner') {
      return json({ error: 'Only the owner can manage staff.' }, 403)
    }

    const body = await req.json()
    const action = body.action as string

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const username = String(body.username ?? '').trim().toLowerCase()
      const firstName = String(body.first_name ?? '').trim()
      const lastName = String(body.last_name ?? '').trim()
      const staffRole = String(body.staff_role ?? '').trim()
      const temporaryPassword = String(body.temporary_password ?? '')

      if (!email || !username || !firstName || !lastName) {
        return json({ error: 'email, username, first_name and last_name are required' }, 400)
      }
      if (!USERNAME_PATTERN.test(username)) {
        return json({ error: 'Username must be 3–32 characters: letters, numbers, underscore.' }, 400)
      }
      if (!STAFF_ROLES.has(staffRole)) {
        return json({ error: 'Invalid staff role' }, 400)
      }
      if (temporaryPassword.length < 8) {
        return json({ error: 'Temporary password must be at least 8 characters' }, 400)
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
      })
      if (createError || !created.user) {
        return json({ error: createError?.message ?? 'Could not create the user' }, 400)
      }

      const { error: profileError } = await admin
        .from('profiles')
        .update({
          role: 'super_admin',
          staff_role: staffRole,
          username,
          first_name: firstName,
          last_name: lastName,
        })
        .eq('id', created.user.id)
      if (profileError) {
        // Half-created staff would be a super_admin with no scoping; undo.
        await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: profileError.message }, 400)
      }

      return json({ ok: true, userId: created.user.id })
    }

    if (action === 'set_role') {
      const userId = String(body.user_id ?? '').trim()
      const staffRole = String(body.staff_role ?? '').trim()
      if (!userId || !STAFF_ROLES.has(staffRole)) {
        return json({ error: 'user_id and a valid staff_role are required' }, 400)
      }
      if (userId === authUserId) {
        return json({ error: 'You cannot change your own role.' }, 400)
      }
      const { error } = await admin
        .from('profiles')
        .update({ staff_role: staffRole })
        .eq('id', userId)
        .eq('role', 'super_admin')
        .neq('staff_role', 'owner')
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'update') {
      const userId = String(body.user_id ?? '').trim()
      if (!userId) return json({ error: 'user_id is required' }, 400)

      const { data: target } = await admin
        .from('profiles')
        .select('role, staff_role')
        .eq('id', userId)
        .maybeSingle()
      if (target?.role !== 'super_admin' || (target.staff_role ?? 'owner') === 'owner') {
        return json({ error: 'Not an editable staff account.' }, 400)
      }

      const firstName = body.first_name != null ? String(body.first_name).trim() : undefined
      const lastName = body.last_name != null ? String(body.last_name).trim() : undefined
      const username = body.username != null ? String(body.username).trim().toLowerCase() : undefined
      const email = body.email != null ? String(body.email).trim().toLowerCase() : undefined
      const password = body.temporary_password != null ? String(body.temporary_password) : undefined

      if (username !== undefined && !USERNAME_PATTERN.test(username)) {
        return json({ error: 'Username must be 3–32 characters: letters, numbers, underscore.' }, 400)
      }
      if (password !== undefined && password.length < 8) {
        return json({ error: 'Temporary password must be at least 8 characters' }, 400)
      }

      if (email !== undefined || password !== undefined) {
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
          ...(email !== undefined ? { email, email_confirm: true } : {}),
          ...(password !== undefined ? { password } : {}),
        })
        if (authUpdateError) return json({ error: authUpdateError.message }, 400)
      }

      const profilePatch: Record<string, string> = {}
      if (firstName !== undefined) profilePatch.first_name = firstName
      if (lastName !== undefined) profilePatch.last_name = lastName
      if (username !== undefined) profilePatch.username = username
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await admin.from('profiles').update(profilePatch).eq('id', userId)
        if (error) return json({ error: error.message }, 400)
      }

      return json({ ok: true })
    }

    if (action === 'remove') {
      const userId = String(body.user_id ?? '').trim()
      if (!userId) return json({ error: 'user_id is required' }, 400)
      if (userId === authUserId) {
        return json({ error: 'You cannot remove yourself.' }, 400)
      }
      const { data: target } = await admin
        .from('profiles')
        .select('role, staff_role')
        .eq('id', userId)
        .maybeSingle()
      if (target?.role !== 'super_admin' || (target.staff_role ?? 'owner') === 'owner') {
        return json({ error: 'Not a removable staff account.' }, 400)
      }
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('[manage-staff] unexpected error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
