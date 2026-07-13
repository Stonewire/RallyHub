import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { NeoButton, NeoCard, NeoInput, NeoLabel } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

export function FacilitatorSettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const orgId = profile?.organization_id ?? null

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null)

  const { data: orgName } = useQuery({
    queryKey: ['facilitator-org-name', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId!)
        .maybeSingle()
      if (error) throw error
      return data?.name ?? null
    },
  })

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !profile || !orgId) return
    if (!firstName.trim() || !lastName.trim()) {
      setStatus({ kind: 'error', msg: 'Please enter your first and last name.' })
      return
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
        },
      })
      if (error) {
        let msg = 'Could not save your changes. Please try again.'
        try {
          const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
            .context?.json?.()
          if (b?.error) msg = b.error
        } catch {
          /* ignore */
        }
        setStatus({ kind: 'error', msg })
        return
      }
      await refreshProfile()
      setStatus({ kind: 'ok', msg: 'Your name has been updated.' })
    } catch {
      setStatus({ kind: 'error', msg: 'Could not save your changes. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update the name shown when you run events.
        </p>
      </header>

      <NeoCard className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <NeoLabel htmlFor="fac-first">First name</NeoLabel>
              <NeoInput
                id="fac-first"
                value={firstName}
                autoComplete="given-name"
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <NeoLabel htmlFor="fac-last">Last name</NeoLabel>
              <NeoInput
                id="fac-last"
                value={lastName}
                autoComplete="family-name"
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <NeoLabel htmlFor="fac-org">Organisation</NeoLabel>
            <NeoInput id="fac-org" value={orgName ?? '—'} readOnly disabled />
            <p className="text-muted-foreground text-xs">
              Contact your organisation admin to change your organisation or role.
            </p>
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
    </div>
  )
}
