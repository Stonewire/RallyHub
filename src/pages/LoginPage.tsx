import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { RallyLogo } from '@/components/brand/RallyLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { resolvePostLoginPath } from '@/lib/auth-routes'

export function LoginPage() {
  const { user, role, loading, profileLoading, signInWithPassword } = useAuth()
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
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="mb-14 flex w-full max-w-xs justify-center px-4">
        <RallyLogo className="mx-auto max-h-16 w-auto sm:max-h-20" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[min(100%,22rem)] flex-col gap-5"
      >
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-foreground font-medium">
            Email
          </Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-card"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="login-password"
            className="text-foreground font-medium"
          >
            Password
          </Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-card"
          />
        </div>
        {error ? (
          <p className="text-destructive text-center text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full font-semibold shadow-sm"
          disabled={pending || loading}
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
