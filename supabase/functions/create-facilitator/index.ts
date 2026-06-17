import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser, requireOrgAdminOrSuperAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/

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
    const password = body.password

    if (!organizationId || !username || !email || !password || !firstName || !lastName) {
      return new Response(
        JSON.stringify({
          error: 'organizationId, username, email, first_name, last_name, and password are required',
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

    const orgAuth = await requireOrgAdminOrSuperAdmin(
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

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        role: 'facilitator',
        organization_id: organizationId,
      },
    })

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (authUser.user) {
      await supabaseAdmin
        .from('profiles')
        .update({
          username,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role: 'facilitator',
          organization_id: organizationId,
        })
        .eq('id', authUser.user.id)
    }

    return new Response(JSON.stringify({ userId: authUser.user?.id, username }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Create facilitator failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
