import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import {
  PASSWORD_RESET_REQUEST_CONFIRMATION,
  passwordResetRedirectUrl,
} from '@/lib/auth-password-reset'
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
    // Resolution + reset email happen server-side (request-password-reset edge
    // function) so the account's email is never exposed to the browser (audit
    // AUD-4). We always show the same generic confirmation, whether or not the
    // account exists, so the page reveals nothing about which accounts exist.
    try {
      await supabase.functions.invoke('request-password-reset', {
        body: { identifier: trimmed, redirectTo: passwordResetRedirectUrl() },
      })
    } catch {
      // Swallow: still show the generic confirmation rather than leak signal.
    }
    setPending(false)
    setSent(true)
  }

  return (
    <AuthPageShell>
      <NeoCard className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-2xl font-black tracking-tight">
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
            <NeoButton type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
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
