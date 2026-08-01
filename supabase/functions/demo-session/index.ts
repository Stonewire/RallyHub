import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { cleanupDemoStorage, cleanupDemoUsers } from '../_shared/demo-cleanup.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requestIsAllowed(req: Request, requestedHost: unknown): boolean {
  const configured = (Deno.env.get('DEMO_HOST') ?? 'demo.rallyhub.games').toLowerCase()
  const origin = req.headers.get('origin')
  const originHost = origin ? new URL(origin).hostname.toLowerCase() : ''
  const bodyHost = typeof requestedHost === 'string' ? requestedHost.toLowerCase() : ''
  const allowed = (host: string) =>
    host === configured || host === 'demo.localhost' || host === 'localhost' || host === '127.0.0.1'
  return allowed(originHost) || (!originHost && allowed(bodyHost))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    if (!requestIsAllowed(req, body.host)) {
      return json({ error: 'Demo access is only available on the demo site.' }, 403)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfiguration' }, 500)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    })

    const { data: existingOrg, error: orgError } = await admin
      .from('organizations')
      .select('id, demo_user_id, demo_reset_at')
      .eq('is_demo', true)
      .maybeSingle()

    if (orgError) throw orgError
    let org = existingOrg

    if (!org) {
      const created = await admin
        .from('organizations')
        .insert({
          name: 'Northstar Experiences',
          subdomain: 'demo',
          custom_domain: Deno.env.get('DEMO_HOST') ?? 'demo.rallyhub.games',
          is_demo: true,
          billing_plan: 'pro',
          billing_period: 'monthly',
          account_status: 'active',
        })
        .select('id, demo_user_id, demo_reset_at')
        .single()
      if (created.error) throw created.error
      org = created.data
    }

    const demoEmail = (Deno.env.get('DEMO_ACCOUNT_EMAIL') ?? 'demo@rallyhub.games').toLowerCase()
    const link = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: demoEmail,
      options: { data: { rallyhub_demo: true, full_name: 'Demo Host', username: 'demo' } },
    })
    if (link.error || !link.data.user) {
      throw link.error ?? new Error('Could not create the demo user.')
    }

    const userId = link.data.user.id
    const userUpdate = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { rallyhub_demo: true, full_name: 'Demo Host', username: 'demo' },
    })
    if (userUpdate.error) throw userUpdate.error

    const profile = await admin.from('profiles').upsert({
      id: userId,
      username: 'demo',
      full_name: 'Demo Host',
      first_name: 'Demo',
      last_name: 'Host',
      role: 'client_admin',
      organization_id: org.id,
      must_change_password: false,
      onboarding_completed_tasks: [],
      onboarding_dismissed: true,
    })
    if (profile.error) throw profile.error

    const orgUpdate = await admin
      .from('organizations')
      .update({ demo_user_id: userId })
      .eq('id', org.id)
    if (orgUpdate.error) throw orgUpdate.error

    const resetDue = !org.demo_reset_at || new Date(org.demo_reset_at).getTime() <= Date.now()
    if (resetDue) {
      await Promise.all([
        cleanupDemoStorage(admin, org.id),
        cleanupDemoUsers(admin, org.id, userId),
      ])
    }

    const reset = await admin.rpc('reset_demo_sandbox', {
      p_organization_id: org.id,
      p_force: false,
    })
    if (reset.error) throw reset.error

    const tokenHash = link.data.properties?.hashed_token
    if (!tokenHash) throw new Error('Demo sign-in token was not generated.')

    return json({ tokenHash })
  } catch (error) {
    console.error('[demo-session]', error)
    return json({ error: error instanceof Error ? error.message : 'The demo is unavailable.' }, 500)
  }
})
