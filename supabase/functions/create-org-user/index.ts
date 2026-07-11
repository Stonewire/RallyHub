import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser, requireOrgUserManagerOrSuperAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const ASSIGNABLE_ROLES = new Set(['facilitator', 'event_manager', 'client_admin'])

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const auth = await requireAuthUser(supabaseAdmin, req.headers.get('Authorization'))
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.message }), {
        status: auth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const organizationId = body.organizationId?.trim()
    const username = normalizeUsername(body.username ?? '')
    const email = body.email?.trim().toLowerCase()
    const firstName = body.first_name?.trim() ?? body.firstName?.trim() ?? ''
    const lastName = body.last_name?.trim() ?? body.lastName?.trim() ?? ''
    const role = (body.role ?? 'event_manager').trim()
    const temporaryPassword = body.temporary_password ?? body.temporaryPassword ?? body.password

    if (!organizationId || !username || !email || !firstName || !lastName || !temporaryPassword) {
      return new Response(
        JSON.stringify({
          error:
            'organizationId, username, email, first_name, last_name, role, and temporary_password are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!USERNAME_PATTERN.test(username)) {
      return new Response(
        JSON.stringify({
          error: 'Username must be 3–32 characters: letters, numbers, underscore only.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!ASSIGNABLE_ROLES.has(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role for organization user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (String(temporaryPassword).length < 8) {
      return new Response(JSON.stringify({ error: 'Temporary password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const orgAuth = await requireOrgUserManagerOrSuperAdmin(
      supabaseAdmin,
      auth.user.id,
      organizationId,
    )
    if (!orgAuth.ok) {
      return new Response(JSON.stringify({ error: orgAuth.message }), {
        status: orgAuth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (orgAuth.role === 'event_manager' && role !== 'facilitator') {
      return new Response(
        JSON.stringify({ error: 'Event managers can only create facilitator accounts' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (existingUsername) {
      return new Response(JSON.stringify({ error: 'Username is already taken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullName = `${firstName} ${lastName}`.trim()

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: String(temporaryPassword),
      email_confirm: true,
      user_metadata: {
        username,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
      },
    })

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (authUser.user) {
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          username,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          role,
          organization_id: organizationId,
          must_change_password: true,
        })
        .eq('id', authUser.user.id)
        .select('id')
        .single()

      if (profileErr) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: memberErr } = await supabaseAdmin.from('organization_members').insert({
        organization_id: organizationId,
        name: fullName,
        email,
        role,
        accepted_at: new Date().toISOString(),
      })

      if (memberErr) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        return new Response(JSON.stringify({ error: memberErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(
      JSON.stringify({
        userId: authUser.user?.id,
        username,
        email,
        role,
        temporary_password: String(temporaryPassword),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Create user failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
