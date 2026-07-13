// CONTACT-1: receives the marketing demo/contact form, stores the lead, and
// emails a notification via Resend. Unauthenticated (called with the anon key
// from the public marketing page), so it does its own validation, honeypot and
// per-IP rate limiting.
//
// Env (set as Edge Function secrets):
//   RESEND_API_KEY    - required to actually send the email. If unset, the lead
//                       is still stored and the request succeeds (deploys safely
//                       ahead of the key, like the Turnstile rollout).
//   CONTACT_TO_EMAIL  - where leads are sent (default hello@rallyhub.games)
//   CONTACT_FROM_EMAIL- verified Resend sender (default "RallyHub <noreply@rallyhub.games>")
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-join-token',
}

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[submit-contact] missing env vars')
      return json({ error: 'Server misconfiguration' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    })

    const body = await req.json().catch(() => ({}))
    // Honeypot: bots fill hidden fields. Pretend success, store nothing.
    if (typeof body.company2 === 'string' && body.company2.trim() !== '') {
      return json({ ok: true })
    }

    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const company = String(body.company ?? '').trim()
    const eventType = String(body.eventType ?? body.event_type ?? '').trim()
    const message = String(body.message ?? '').trim()

    if (!name || !email) {
      return json({ error: 'Name and email are required.' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Please enter a valid email address.' }, 400)
    }
    if (name.length > 200 || email.length > 320 || (message && message.length > 5000)) {
      return json({ error: 'One of the fields is too long.' }, 400)
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // Per-IP rate limit.
    const { count } = await admin
      .from('contact_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gt('created_at', new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString())
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return json({ error: 'Too many requests. Please try again later.' }, 429)
    }

    const { data: row, error: insertErr } = await admin
      .from('contact_submissions')
      .insert({
        name,
        email,
        company: company || null,
        event_type: eventType || null,
        message: message || null,
        ip_address: ip,
      })
      .select('id')
      .single()
    if (insertErr) {
      console.error('[submit-contact] insert:', insertErr.message)
      return json({ error: 'Could not save your request. Please try again.' }, 500)
    }

    // Send notification via Resend when configured. Failure to email must not
    // fail the request — the lead is already saved.
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      const toEmail = Deno.env.get('CONTACT_TO_EMAIL') ?? 'hello@rallyhub.games'
      const fromEmail = Deno.env.get('CONTACT_FROM_EMAIL') ?? 'RallyHub <noreply@rallyhub.games>'
      const html = `
        <div style="font-family:Manrope,Arial,sans-serif;font-size:15px;color:#333">
          <h2 style="margin:0 0 12px">New RallyHub demo request</h2>
          <p style="margin:4px 0"><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p style="margin:4px 0"><strong>Email:</strong> ${escapeHtml(email)}</p>
          ${company ? `<p style="margin:4px 0"><strong>Organisation:</strong> ${escapeHtml(company)}</p>` : ''}
          ${eventType ? `<p style="margin:4px 0"><strong>Planning:</strong> ${escapeHtml(eventType)}</p>` : ''}
          ${message ? `<p style="margin:12px 0 4px"><strong>Message:</strong></p><p style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</p>` : ''}
        </div>`
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            reply_to: email,
            subject: `Demo request: ${company || name}`,
            html,
          }),
        })
        if (res.ok) {
          await admin.from('contact_submissions').update({ emailed: true }).eq('id', row.id)
        } else {
          console.error('[submit-contact] resend failed:', res.status, await res.text())
        }
      } catch (err) {
        console.error('[submit-contact] resend error:', err)
      }
    }

    return json({ ok: true })
  } catch (err) {
    console.error('[submit-contact] unexpected:', err)
    return json({ error: err instanceof Error ? err.message : 'Contact submission failed' }, 500)
  }
})
