import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { WrongDomainError } from '@/components/auth/WrongDomainError'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { resolvePostLoginPath, wrongDomainRedirectUrl } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'
import { isDemoHost } from '@/lib/demo-sandbox'
import { supabase } from '@/lib/supabase'

// The wrong-domain flow latches into local state because signing the session
// out (which every branch must do) makes `user` null and would otherwise
// unmount whatever we were showing: this is exactly what made the old
// jump-link error flash and vanish before anyone could click it.
type WrongDomainState =
  | { kind: 'carrying-across' }
  | { kind: 'staff-jump-link'; targetUrl: string }

export function LoginPage() {
  const { user, role, loading, profileLoading, profile, signInWithIdentifier, authError } = useAuth()
  const location = useLocation()
  const { t } = useTranslation('common')
  const [searchParams] = useSearchParams()

  // Set when a client account tried to sign in on admin.rallyhub.games and
  // was carried across to this (app-host) login page.
  const cameFromAdminDomain = searchParams.get('from') === 'admin-domain'

  const from =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof (location.state as { from?: unknown }).from === 'string'
      ? (location.state as { from: string }).from
      : undefined

  const successMessage =
    typeof location.state === 'object' &&
    location.state &&
    'message' in location.state &&
    typeof (location.state as { message?: unknown }).message === 'string'
      ? (location.state as { message: string }).message
      : null

  const [identifier, setIdentifier] = useState(() =>
    cameFromAdminDomain ? (searchParams.get('identifier') ?? '') : '',
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [wrongDomainState, setWrongDomainState] = useState<WrongDomainState | null>(null)

  const postAuthReady = !loading && Boolean(user) && !profileLoading
  const wrongDomain = postAuthReady ? wrongDomainRedirectUrl(role, identifier.trim()) : null

  // Side effect (signing the wrong-domain session out) belongs in an effect,
  // not inline during render: this keeps it from re-firing on every render
  // while `wrongDomain` stays truthy and only runs once the value settles.
  // The latch is set in the sign-out callback (not synchronously in the
  // effect body) so what we show survives the session disappearing.
  useEffect(() => {
    if (!wrongDomain) return
    const carryingAcross = role !== 'super_admin'
    void supabase.auth.signOut({ scope: 'local' }).then(() => {
      setWrongDomainState(
        carryingAcross
          ? { kind: 'carrying-across' }
          : { kind: 'staff-jump-link', targetUrl: wrongDomain },
      )
    })
    if (carryingAcross) {
      // Client role on the admin host: sessions are per-origin, so drop
      // this one and carry them straight to the app-host login with their
      // typed identifier (never the password).
      window.location.assign(wrongDomain)
    }
  }, [wrongDomain, role])

  const staffJumpLink =
    wrongDomain && role === 'super_admin'
      ? wrongDomain
      : wrongDomainState?.kind === 'staff-jump-link'
        ? wrongDomainState.targetUrl
        : null

  if (staffJumpLink) {
    // Staff on the app host: the jump link stays up after the local
    // sign-out instead of flashing away with the session (the old bug).
    return (
      <AuthPageShell>
        <NeoCard className="w-full max-w-sm space-y-4 p-8 text-center">
          <WrongDomainError
            message="Staff accounts sign in at admin.rallyhub.games."
            targetUrl={staffJumpLink}
          />
        </NeoCard>
      </AuthPageShell>
    )
  }

  if (wrongDomain || wrongDomainState?.kind === 'carrying-across') {
    return <AuthLoadingScreen label="Redirecting" />
  }

  if (!loading && user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (postAuthReady) {
    if (profile?.must_change_password) {
      return <Navigate to="/login/change-password" replace state={{ from }} />
    }
    const target = resolvePostLoginPath(from, role)
    return <Navigate to={target} replace />
  }

  if (!loading && !user && isDemoHost()) {
    return (
      <AuthPageShell>
        <NeoCard className="w-full max-w-sm space-y-5 p-8 text-center">
          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-black tracking-tight">
              Demo temporarily unavailable
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {authError ?? 'We could not start the demo session.'}
            </p>
          </div>
          <NeoButton className="w-full" onClick={() => window.location.reload()}>
            Try again
          </NeoButton>
        </NeoCard>
      </AuthPageShell>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signInWithIdentifier(identifier, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthPageShell>
      <NeoCard className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-2xl font-black tracking-tight">Sign in</h1>
          {isPlatformHost() ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in with your organization or RallyHub staff account
            </p>
          ) : null}
        </div>

        {cameFromAdminDomain ? (
          <p className="text-foreground bg-muted/50 rounded-lg px-3 py-2.5 text-center text-sm leading-relaxed" role="status">
            {t('login.fromAdminDomain')}
          </p>
        ) : null}

        {successMessage ? (
          <p className="text-foreground bg-muted/50 rounded-lg px-3 py-2.5 text-center text-sm leading-relaxed" role="status">
            {successMessage}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <NeoLabel htmlFor="login-identifier">Username or email</NeoLabel>
            <NeoInput
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <NeoLabel htmlFor="login-password">Password</NeoLabel>
              <Link
                to="/login/forgot"
                className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 transition-colors hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <NeoInput
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={pending || loading}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </NeoButton>
        </form>

        {isPlatformHost() ? (
          <p className="text-muted-foreground text-center text-sm">
            New to RallyHub?{' '}
            <Link
              to="/register"
              className="text-foreground font-medium underline underline-offset-2 hover:text-foreground/80"
            >
              Or create an account
            </Link>
          </p>
        ) : null}
      </NeoCard>
    </AuthPageShell>
  )
}
