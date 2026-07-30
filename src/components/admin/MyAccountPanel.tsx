import { Pencil, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { DangerZone } from '@/components/admin/DangerZone'
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
  const [editingName, setEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null)

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'My account'
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || username.slice(0, 2).toUpperCase()
  const dirty = Boolean(
    firstName !== (profile?.first_name ?? '') ||
    lastName !== (profile?.last_name ?? '') ||
    username !== (profile?.username ?? '') ||
    email !== (user?.email ?? '') ||
    password ||
    confirmPassword,
  )
  const passwordsMatch = !password || password === confirmPassword

  function discardChanges() {
    setFirstName(profile?.first_name ?? '')
    setLastName(profile?.last_name ?? '')
    setUsername(profile?.username ?? '')
    setEmail(user?.email ?? '')
    setPassword('')
    setConfirmPassword('')
    setEditingName(false)
    setStatus(null)
  }

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
    <form onSubmit={onSubmit}>
      {dirty ? <div className="mb-4 flex justify-end gap-2">
          <NeoButton variant="surface" type="button" disabled={saving} onClick={discardChanges}>
            Discard
          </NeoButton>
          <NeoButton variant="primary" type="submit" disabled={saving || !passwordsMatch}>
            {saving ? 'Saving…' : 'Save'}
          </NeoButton>
      </div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <NeoCard className="space-y-4 p-4">
            <h2 className="text-foreground text-sm font-bold">Profile Photo</h2>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0" title="Profile photo uploads require account storage support">
                <div className="bg-nm-slate-400 text-nm-slate-900 border-border flex size-24 items-center justify-center rounded-full border-2 text-2xl font-bold">
                  {initials}
                </div>
                <span className="bg-primary text-primary-foreground border-card absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-2">
                  <Upload className="size-3.5" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <NeoInput id="acct-first" value={firstName} autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} aria-label="First name" autoFocus />
                    <NeoInput id="acct-last" value={lastName} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} aria-label="Last name" onBlur={() => setEditingName(false)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-foreground truncate text-xl font-bold">{displayName}</p>
                    <button type="button" className="text-muted-foreground hover:text-foreground rounded p-1" aria-label="Edit name" onClick={() => setEditingName(true)}>
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-muted-foreground mt-1 truncate text-xs">@{username}</p>
              </div>
            </div>
          </NeoCard>

          <NeoCard className="space-y-4 p-4">
            <h2 className="text-foreground text-sm font-bold">Personal Details</h2>
            <div className="grid gap-1.5">
              <NeoLabel htmlFor="acct-username">Username</NeoLabel>
              <NeoInput id="acct-username" value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <NeoLabel htmlFor="acct-email">Email</NeoLabel>
              <NeoInput id="acct-email" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
            </div>
            {orgName !== undefined ? (
              <div className="grid gap-1.5">
                <NeoLabel htmlFor="acct-org">Organisation</NeoLabel>
                <NeoInput id="acct-org" value={orgName ?? '—'} readOnly disabled />
              </div>
            ) : null}
          </NeoCard>
        </div>

        <div className="flex flex-col gap-4">
          <NeoCard className="space-y-4 p-4">
            <div>
              <h2 className="text-foreground text-sm font-bold">Password</h2>
              <p className="text-muted-foreground mt-1 text-xs">Leave both fields empty to keep your current password.</p>
            </div>
            <div className="grid gap-1.5">
              <NeoLabel htmlFor="acct-password">New Password</NeoLabel>
              <NeoInput id="acct-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <NeoLabel htmlFor="acct-password-confirm">Confirm New Password</NeoLabel>
              <NeoInput id="acct-password-confirm" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
            {!passwordsMatch && confirmPassword ? (
              <p className="text-destructive text-xs font-medium" role="alert">Passwords do not match.</p>
            ) : null}
            <NeoButton variant="primary" type="submit" size="sm" className="w-fit" disabled={!password || password.length < 8 || !passwordsMatch || saving}>
              {saving ? 'Updating…' : 'Update Password'}
            </NeoButton>
          </NeoCard>

          <DangerZone
            rows={[
              {
                id: 'logout-all-devices',
                label: 'Log out of all devices',
                description: 'Ends every other active session. Secure session revocation is not enabled yet.',
                action: <NeoButton type="button" variant="surface" disabled>Log Out All</NeoButton>,
              },
              {
                id: 'delete-personal-account',
                label: 'Delete my account',
                description: 'Permanently removes your personal access. Organisation data is unaffected.',
                action: <NeoButton type="button" variant="destructive" disabled>Delete</NeoButton>,
              },
            ]}
          />
        </div>
      </div>

      {status ? (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-4 text-sm font-medium ${status.kind === 'error' ? 'text-[#c0574f]' : 'text-[#1f9d55]'}`}>
          {status.msg}
        </p>
      ) : null}
    </form>
  )
}
