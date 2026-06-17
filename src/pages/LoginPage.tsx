import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { resolvePostLoginPath } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

export function LoginPage() {
  const { user, role, loading, profileLoading, profile, signInWithIdentifier } = useAuth()
  const location = useLocation()

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

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!loading && user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (!loading && user && !profileLoading) {
    if (profile?.must_change_password) {
      return <Navigate to="/login/change-password" replace state={{ from }} />
    }
    const target = resolvePostLoginPath(from, role)
    return <Navigate to={target} replace />
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
          <h1 className="text-foreground text-xl font-semibold tracking-tight">Sign in</h1>
          {isPlatformHost() ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in with your organization or RallyHub staff account
            </p>
          ) : null}
        </div>

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
            variant="primary"
            size="lg"
            className="w-full"
            disabled={pending || loading}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </NeoButton>
        </form>
      </NeoCard>
    </AuthPageShell>
  )
}
