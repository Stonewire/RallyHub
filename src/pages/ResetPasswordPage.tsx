import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { PASSWORD_UPDATED_MESSAGE } from '@/lib/auth-password-reset'
import { supabase } from '@/lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function initSession() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError && !cancelled) {
          setSessionError('This reset link is invalid or has expired.')
          setChecking(false)
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const recoveryType = hashParams.get('type') === 'recovery'

      if (session || recoveryType) {
        setReady(true)
      } else {
        setSessionError('This reset link is invalid or has expired.')
      }
      setChecking(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setSessionError(null)
        setChecking(false)
      }
    })

    void initSession()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

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

      await supabase.auth.signOut()
      navigate('/login', {
        replace: true,
        state: { message: PASSWORD_UPDATED_MESSAGE },
      })
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
            Choose a new password
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Enter and confirm your new password below.
          </p>
        </div>

        {checking ? (
          <p className="text-muted-foreground text-center text-sm">Verifying reset link…</p>
        ) : sessionError ? (
          <div className="space-y-5">
            <p className="text-destructive text-center text-sm" role="alert">
              {sessionError}
            </p>
            <NeoButton variant="primary" size="lg" className="w-full" asChild>
              <Link to="/login/forgot">Request a new reset link</Link>
            </NeoButton>
            <NeoButton variant="ghost" size="md" className="w-full" asChild>
              <Link to="/login">Back to sign in</Link>
            </NeoButton>
          </div>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <NeoLabel htmlFor="reset-password">New password</NeoLabel>
              <NeoInput
                id="reset-password"
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
              <NeoLabel htmlFor="reset-password-confirm">Confirm password</NeoLabel>
              <NeoInput
                id="reset-password-confirm"
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
              {pending ? 'Updating…' : 'Update password'}
            </NeoButton>
          </form>
        ) : null}
      </NeoCard>
    </AuthPageShell>
  )
}
