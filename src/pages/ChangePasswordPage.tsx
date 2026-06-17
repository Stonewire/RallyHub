import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { resolvePostLoginPath } from '@/lib/auth-routes'
import { supabase } from '@/lib/supabase'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, profile, profileLoading, refreshProfile } = useAuth()

  const from =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof (location.state as { from?: unknown }).from === 'string'
      ? (location.state as { from: string }).from
      : undefined

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!user || profileLoading) return
    if (!profile?.must_change_password) {
      navigate(resolvePostLoginPath(from, role), { replace: true })
    }
  }, [user, profile, profileLoading, from, role, navigate])

  if (!user && !profileLoading) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (profileLoading || !profile) {
    return <AuthLoadingScreen label="Loading profile" />
  }

  if (!profile.must_change_password) {
    return <AuthLoadingScreen label="Redirecting" />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      const { error: clearError } = await supabase.rpc('clear_must_change_password')
      if (clearError) throw clearError

      await refreshProfile()
      navigate(resolvePostLoginPath(from, role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthPageShell>
      <NeoCard className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            Set your password
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your account was created with a temporary password. Choose a new password to
            continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <NeoLabel htmlFor="new-password">New password</NeoLabel>
            <NeoInput
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <NeoLabel htmlFor="new-password-confirm">Confirm password</NeoLabel>
            <NeoInput
              id="new-password-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {pending ? 'Saving…' : 'Continue'}
          </NeoButton>
        </form>
      </NeoCard>
    </AuthPageShell>
  )
}
