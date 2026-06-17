import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import {
  PASSWORD_RESET_REQUEST_CONFIRMATION,
  passwordResetRedirectUrl,
} from '@/lib/auth-password-reset'
import { resolveLoginEmail } from '@/lib/auth-identifier'
import { supabase } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = identifier.trim()
    if (!trimmed) {
      setError('Enter your username or email.')
      return
    }

    setPending(true)
    let emailForReset: string | null = null
    try {
      emailForReset = await resolveLoginEmail(trimmed)
    } catch {
      setPending(false)
      setError('Could not look up that account.')
      return
    }
    if (!emailForReset) {
      setPending(false)
      setSent(true)
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailForReset, {
      redirectTo: passwordResetRedirectUrl(),
    })
    setPending(false)

    if (resetError && /invalid/i.test(resetError.message)) {
      setError('Enter a valid email address.')
      return
    }

    setSent(true)
  }

  return (
    <AuthPageShell>
      <NeoCard className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            Reset password
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Enter your username or email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <p className="text-foreground text-center text-sm leading-relaxed" role="status">
              {PASSWORD_RESET_REQUEST_CONFIRMATION}
            </p>
            <NeoButton variant="surface" size="lg" className="w-full" asChild>
              <Link to="/login">Back to sign in</Link>
            </NeoButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <NeoLabel htmlFor="forgot-identifier">Username or email</NeoLabel>
              <NeoInput
                id="forgot-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-destructive text-center text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <NeoButton type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </NeoButton>
            <NeoButton variant="ghost" size="md" className="w-full" asChild>
              <Link to="/login">Back to sign in</Link>
            </NeoButton>
          </form>
        )}
      </NeoCard>
    </AuthPageShell>
  )
}
