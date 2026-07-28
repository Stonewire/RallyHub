import { useState, type FormEvent } from 'react'

import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

/**
 * Personal account settings (name, username, email, password) for the
 * signed-in user. Backed by the update-org-user Edge Function, which already
 * allows self-service edits for any role (client_admin, event_manager,
 * facilitator) without requiring org-admin privileges.
 */
export function MyAccountPanel({ orgName }: { orgName?: string | null }) {
  const { user, profile, refreshProfile } = useAuth()
  const orgId = profile?.organization_id ?? null

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !profile || !orgId || !user) return

    if (!firstName.trim() || !lastName.trim()) {
      setStatus({ kind: 'error', msg: 'Please enter your first and last name.' })
      return
    }
    if (!username.trim()) {
      setStatus({ kind: 'error', msg: 'Please enter a username.' })
      return
    }
    if (!email.trim()) {
      setStatus({ kind: 'error', msg: 'Please enter an email.' })
      return
    }
    if (password) {
      if (password.length < 8) {
        setStatus({ kind: 'error', msg: 'Password must be at least 8 characters.' })
        return
      }
      if (password !== confirmPassword) {
        setStatus({ kind: 'error', msg: 'Passwords do not match.' })
        return
      }
    }

    setSaving(true)
    setStatus(null)
    try {
      const { error } = await supabase.functions.invoke('update-org-user', {
        body: {
          organizationId: orgId,
          userId: profile.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim(),
          email: email.trim(),
          ...(password ? { password } : {}),
        },
      })
      if (error) {
        let msg = 'Could not save your changes. Please try again.'
        try {
          const body = await (
            error as { context?: { json?: () => Promise<{ error?: string }> } }
          ).context?.json?.()
          if (body?.error) msg = body.error
        } catch {
          /* ignore */
        }
        setStatus({ kind: 'error', msg })
        return
      }
      await refreshProfile()
      setPassword('')
      setConfirmPassword('')
      setStatus({ kind: 'ok', msg: 'Your account has been updated.' })
    } catch {
      setStatus({ kind: 'error', msg: 'Could not save your changes. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <NeoCard className="p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <NeoLabel htmlFor="acct-first">First name</NeoLabel>
            <NeoInput
              id="acct-first"
              value={firstName}
              autoComplete="given-name"
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <NeoLabel htmlFor="acct-last">Last name</NeoLabel>
            <NeoInput
              id="acct-last"
              value={lastName}
              autoComplete="family-name"
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <NeoLabel htmlFor="acct-username">Username</NeoLabel>
          <NeoInput
            id="acct-username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Letters, numbers, and underscores only. Used to sign in.
          </p>
        </div>

        <div className="grid gap-1.5">
          <NeoLabel htmlFor="acct-email">Email</NeoLabel>
          <NeoInput
            id="acct-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {orgName !== undefined ? (
          <div className="grid gap-1.5">
            <NeoLabel htmlFor="acct-org">Organisation</NeoLabel>
            <NeoInput id="acct-org" value={orgName ?? '—'} readOnly disabled />
            <p className="text-muted-foreground text-xs">
              Contact your organisation admin to change your organisation or role.
            </p>
          </div>
        ) : null}

        <div className="border-border/80 grid gap-4 border-t pt-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <NeoLabel htmlFor="acct-password">New password</NeoLabel>
            <NeoInput
              id="acct-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Leave blank to keep current"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <NeoLabel htmlFor="acct-password-confirm">Confirm new password</NeoLabel>
            <NeoInput
              id="acct-password-confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {status ? (
          <p
            role={status.kind === 'error' ? 'alert' : 'status'}
            className={`text-sm font-medium ${status.kind === 'error' ? 'text-[#c0574f]' : 'text-[#1f9d55]'}`}
          >
            {status.msg}
          </p>
        ) : null}

        <div className="flex justify-end">
          <NeoButton variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </NeoButton>
        </div>
      </form>
    </NeoCard>
  )
}
