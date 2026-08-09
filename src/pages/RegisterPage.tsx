import { Check as IconCheck } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { SegmentedPill } from '@/components/neo-minimal/SegmentedPill'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import {
  formatDualMonthlyPriceLine,
  getSelfServePlans,
  normalizePlanId,
  planFeatures,
  VAT_DISCLAIMER,
} from '@/lib/subscription-plans'
import { recordLegalAcceptanceForCurrentUser } from '@/hooks/use-legal-acceptance'
import { isPlatformHost } from '@/lib/tenant'
import { RESERVED_TENANT_SUBDOMAINS } from '@/lib/public-routes'

// Custom is contact-sales only — getSelfServePlans() excludes it here so a
// visitor can never pick a plan that then silently falls back to Free server-side.
const PLANS = getSelfServePlans()

export function RegisterPage() {
  const { user, signInWithIdentifier } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const requestedPlan = normalizePlanId(searchParams.get('plan'))

  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState(requestedPlan)
  const selectedPlan = PLANS.find((p) => p.id === plan) ?? null
  const [isSchool, setIsSchool] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  // Self-serve signup is a platform-host concept (it creates a brand-new org).
  // On a tenant host, registration doesn't apply — send people to sign in.
  // Checked after all hooks above so the hook-call order never changes
  // across renders (an early return before them crashed React the moment
  // `user` or the host check changed value mid-mount — e.g. a stale/expired
  // session resolving after first paint).
  if (!isPlatformHost() || user) return <Navigate to="/login" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!acceptedLegal) {
      setError('Please accept the Terms of Service, Privacy Policy and Data Processing Agreement.')
      return
    }
    if (!turnstileToken) {
      setError('Please complete the verification below.')
      return
    }
    // register-client auto-slugifies orgName server-side and does not let the
    // user type a subdomain directly, so a DB-trigger rejection there would be
    // a startling, hard-to-explain error (e.g. an org literally named "Admin").
    // Catch the common case client-side before hitting the edge function.
    const previewSlug = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (RESERVED_TENANT_SUBDOMAINS.has(previewSlug)) {
      setError(`"${orgName}" produces a reserved URL slug. Please choose a different organisation name.`)
      return
    }
    if (previewSlug.length > 63) {
      setError('Organisation name is too long for a URL. Please use a shorter organisation name.')
      return
    }
    setPending(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-client', {
        body: { orgName, fullName, email, password, plan, isSchool, turnstileToken },
      })
      if (fnError) {
        // Extract the real error message from the response body when available
        let msg = fnError.message
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await (fnError as any).context?.json?.()
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)

      // Auto-sign-in, then hand off to /login which forwards an authed user to
      // their admin panel. Falls back to a manual sign-in prompt if needed.
      try {
        await signInWithIdentifier(email, password)
        // They ticked the box on this form, so record it now that they have a
        // session. Best-effort: if it fails, LegalAcceptanceGate asks them again
        // on first login rather than letting them through unaccepted.
        await recordLegalAcceptanceForCurrentUser().catch(() => {})
        navigate('/login', { replace: true })
      } catch {
        navigate('/login', {
          replace: true,
          state: { message: 'Account created! Please sign in to continue.' },
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthPageShell>
      <NeoCard className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-2xl font-black tracking-tight">Create your account</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Start running live team games. Paid plans include a 1-month free trial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <NeoLabel htmlFor="reg-org">Organization name</NeoLabel>
            <NeoInput
              id="reg-org"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="reg-name">Your name</NeoLabel>
            <NeoInput
              id="reg-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="reg-email">Email</NeoLabel>
            <NeoInput
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="reg-password">Password</NeoLabel>
            <NeoInput
              id="reg-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-muted-foreground text-xs">At least 8 characters.</p>
          </div>

          <div className="space-y-2.5">
            <NeoLabel>Plan</NeoLabel>
            {/* One track with the indicator sliding between the plans, rather
                than a dropdown that hides two of the three behind a tap. */}
            <SegmentedPill
              aria-label="Plan"
              // "Pay Per Event" truncated in a third of this card's width. The
              // segment is shortened rather than the plan renamed: it keeps its
              // full name in billing, on the pricing page and on the invoice.
              options={PLANS.map((p) => ({
                value: p.id,
                label: p.name === 'Pay Per Event' ? 'Per Event' : p.name,
              }))}
              value={plan}
              onChange={(next) => setPlan(normalizePlanId(next))}
            />
            {/* What the chosen plan actually gives you, from the same list the
                pricing page shows, so the two cannot drift apart. */}
            {selectedPlan ? (
              <div className="border-border/70 bg-muted/40 space-y-2 rounded-xl border p-3.5">
                <p className="text-sm font-black">
                  {formatDualMonthlyPriceLine(selectedPlan)}
                </p>
                <ul className="space-y-1.5">
                  {planFeatures(selectedPlan).map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm">
                      <IconCheck className="text-nm-yellow mt-0.5 size-4 shrink-0" />
                      <span className="text-muted-foreground">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">{VAT_DISCLAIMER}</p>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={isSchool}
              onChange={(e) => setIsSchool(e.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span className="text-muted-foreground">
              We are a school. <span className="text-foreground">Schools get 50% off</span> all
              plans and events once we verify your account.
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              required
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="accent-primary mt-0.5 size-4 shrink-0"
            />
            <span className="text-muted-foreground">
              I have read and accept the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-foreground underline">
                Terms of Service
              </Link>
              ,{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-foreground underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link to="/dpa" target="_blank" rel="noopener noreferrer" className="text-foreground underline">
                Data Processing Agreement
              </Link>
              . I am authorised to accept these on behalf of my organisation.
            </span>
          </label>

          <div className="flex justify-center">
            <TurnstileWidget
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
            />
          </div>

          {error ? (
            <p className="text-destructive text-center text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <NeoButton
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={pending}
          >
            {pending ? 'Creating account…' : 'Create account'}
          </NeoButton>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-foreground font-medium underline underline-offset-2 hover:text-foreground/80"
          >
            Sign in
          </Link>
        </p>
      </NeoCard>
    </AuthPageShell>
  )
}
