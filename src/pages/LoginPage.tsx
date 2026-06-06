import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { RallyLogo } from '@/components/brand/RallyLogo'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { useTenant } from '@/contexts/tenant-context'
import { resolvePostLoginPath } from '@/lib/auth-routes'
import { isPlatformHost, isTenantHost } from '@/lib/tenant'

export function LoginPage() {
  const { user, role, loading, profileLoading, signInWithPassword } = useAuth()
  const { tenantOrg, tenantLoading } = useTenant()
  const location = useLocation()

  const from =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof (location.state as { from?: unknown }).from === 'string'
      ? (location.state as { from: string }).from
      : undefined

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!loading && user && profileLoading) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (!loading && user && !profileLoading) {
    const target = resolvePostLoginPath(from, role)
    return <Navigate to={target} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="neo-minimal-scope neo-minimal-inset flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <RallyLogo className="mx-auto max-h-16 w-auto sm:max-h-20" />
        {isTenantHost() && tenantOrg ? (
          <p className="text-muted-foreground text-sm font-medium">{tenantOrg.name}</p>
        ) : null}
        {isTenantHost() && tenantLoading ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : null}
      </div>

      <NeoCard className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">Sign in</h1>
          {isPlatformHost() ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in with your organization or RallyHub staff account
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <NeoLabel htmlFor="login-email">Email</NeoLabel>
            <NeoInput
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="login-password">Password</NeoLabel>
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
    </div>
  )
}
