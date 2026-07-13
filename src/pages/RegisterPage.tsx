import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import {
  formatPerEventPrice,
  formatYearlyPrice,
  getSelfServePlans,
  normalizePlanId,
  VAT_DISCLAIMER,
} from '@/lib/subscription-plans'
import { isPlatformHost } from '@/lib/tenant'

// Enterprise is contact-sales only — getSelfServePlans() excludes it here so a
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
  const [isSchool, setIsSchool] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

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
    if (!turnstileToken) {
      setError('Please complete the verification below.')
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
          <h1 className="text-foreground text-xl font-semibold tracking-tight">Create your account</h1>
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

          <div className="space-y-2">
            <NeoLabel htmlFor="reg-plan">Plan</NeoLabel>
            <select
              id="reg-plan"
              value={plan}
              onChange={(e) => setPlan(normalizePlanId(e.target.value))}
              className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatYearlyPrice(p)} · {formatPerEventPrice(p)}
                </option>
              ))}
            </select>
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
            variant="primary"
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
