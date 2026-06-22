import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser, requireOrgUserManagerOrSuperAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

// Item 5: a client_admin (or super_admin) sets another member's password.
// Scoped to the caller's own org — the target user must belong to organizationId.
// Self-service "change my own password" does NOT use this; the client calls
// supabase.auth.updateUser({ password }) directly.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const auth = await requireAuthUser(supabaseAdmin, req.headers.get('Authorization'))
    if (!auth.ok) return json({ error: auth.message }, auth.status)

    const body = await req.json()
    const organizationId = body.organizationId?.trim()
    const targetUserId = (body.userId ?? body.user_id)?.trim()
    const newPassword = body.password ?? body.newPassword

    if (!organizationId || !targetUserId || !newPassword) {
      return json({ error: 'organizationId, userId, and password are required' }, 400)
    }
    if (String(newPassword).length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400)
    }

    const orgAuth = await requireOrgUserManagerOrSuperAdmin(
      supabaseAdmin,
      auth.user.id,
      organizationId,
    )
    if (!orgAuth.ok) return json({ error: orgAuth.message }, orgAuth.status)

    // Target must belong to this org (super_admin bypasses via the helper above,
    // but we still verify the user is in the named org so passwords can't be set
    // cross-tenant by reusing a token).
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', targetUserId)
      .maybeSingle()

    if (!targetProfile || targetProfile.organization_id !== organizationId) {
      return json({ error: 'User is not a member of this organization' }, 404)
    }

    // Event managers may only reset facilitators (mirrors create-org-user rules).
    if (orgAuth.role === 'event_manager' && targetProfile.role !== 'facilitator') {
      return json({ error: 'Event managers can only reset facilitator passwords' }, 403)
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: String(newPassword),
      user_metadata: { must_change_password: true },
    })
    if (updateErr) return json({ error: updateErr.message }, 400)

    await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', targetUserId)

    return json({ ok: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Set password failed' }, 500)
  }
})
