import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'org'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { name, email, password, subdomain, billing_plan } = await req.json()
    if (!name?.trim() || !email?.trim() || !password) {
      return new Response(JSON.stringify({ error: 'name, email, password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sub = (subdomain ?? slugify(name)).trim().toLowerCase()
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('subdomain', sub)
      .maybeSingle()

    if (existing) {
      sub = `${sub}-${Date.now().toString(36).slice(-4)}`
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: name.trim(),
        contact_email: email.trim(),
        subdomain: sub,
        billing_plan: billing_plan ?? 'starter',
      })
      .select()
      .single()

    if (orgErr) {
      return new Response(JSON.stringify({ error: orgErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin.rpc('seed_organization_defaults', { p_org_id: org.id })

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })

    if (authErr) {
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (authUser.user) {
      await supabaseAdmin
        .from('profiles')
        .update({ organization_id: org.id, role: 'client_admin' })
        .eq('id', authUser.user.id)
    }

    return new Response(JSON.stringify({ org, userId: authUser.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Create client failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
