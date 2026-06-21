import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAuthUser, requireOrgAdminOrSuperAdmin } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const auth = await requireAuthUser(supabaseAdmin, authHeader)
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.message }), {
        status: auth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, organizationId } = await req.json()
    if (!email || !organizationId) {
      return new Response(JSON.stringify({ error: 'email and organizationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: Deno.env.get('INVITE_REDIRECT_URL') ?? undefined,
      data: { organization_id: organizationId },
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invite failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
