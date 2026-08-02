import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton, NeoInput, NeoLabel, NeoStatusBadge } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { STAFF_ROLE_LABELS } from '@/lib/auth-routes'
import { supabase } from '@/lib/supabase'
import type { StaffRole } from '@/types/database'
import type { Tables } from '@/types/helpers'

const ASSIGNABLE: StaffRole[] = ['platform_admin', 'support_agent', 'content_manager', 'finance']

const ROLE_HELP: Record<StaffRole, string> = {
  owner: 'Everything, including the locks below.',
  platform_admin: 'Manages clients and promo codes. Cannot change plans, mark invoices paid, delete clients or manage staff.',
  support_agent: 'Support tickets, with read-only clients.',
  content_manager: 'The platform game library only.',
  finance: 'Payments view and promo codes.',
}

type StaffProfile = Pick<
  Tables<'profiles'>,
  'id' | 'username' | 'first_name' | 'last_name' | 'staff_role' | 'avatar_url'
>

const STAFF_KEY = ['rallyhub', 'staff'] as const

function useStaff() {
  return useQuery({
    queryKey: STAFF_KEY,
    queryFn: async (): Promise<StaffProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, staff_role, avatar_url')
        .eq('role', 'super_admin')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

async function invokeManageStaff(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body })
  if (error) {
    let message = 'Staff action failed.'
    try {
      const parsed = await (
        error as { context?: { json?: () => Promise<{ error?: string }> } }
      ).context?.json?.()
      if (parsed?.error) message = parsed.error
    } catch {
      /* keep the fallback */
    }
    throw new Error(message)
  }
  return data
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  staffRole: 'support_agent' as StaffRole,
}

/**
 * RallyHub's own team: who works the platform panel and with which tier.
 * Owner-only, matching the manage-staff function behind it.
 */
export function RallyHubStaffPanel() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const staffQuery = useStaff()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<StaffProfile | null>(null)

  const act = useMutation({
    mutationFn: invokeManageStaff,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STAFF_KEY }),
  })

  async function handleCreate() {
    setError(null)
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim()) {
      setError('Every field is required.')
      return
    }
    if (form.password.length < 8) {
      setError('Temporary password must be at least 8 characters.')
      return
    }
    try {
      await act.mutateAsync({
        action: 'create',
        first_name: form.firstName,
        last_name: form.lastName,
        username: form.username,
        email: form.email,
        temporary_password: form.password,
        staff_role: form.staffRole,
      })
      setAddOpen(false)
      setForm(EMPTY_FORM)
      setMessage(
        `${form.firstName} added as ${STAFF_ROLE_LABELS[form.staffRole]}. Send them the temporary password yourself; nothing is emailed.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the staff member.')
    }
  }

  async function handleRoleChange(member: StaffProfile, staffRole: StaffRole) {
    setError(null)
    try {
      await act.mutateAsync({ action: 'set_role', user_id: member.id, staff_role: staffRole })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the role.')
    }
  }

  async function handleRemove() {
    if (!pendingRemove) return
    setError(null)
    try {
      await act.mutateAsync({ action: 'remove', user_id: pendingRemove.id })
      setPendingRemove(null)
      setMessage('Staff account removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the account.')
    }
  }

  if (staffQuery.isLoading) return <QueryLoading rows={3} />
  if (staffQuery.isError) return <QueryError message={staffQuery.error.message} />

  const staff = staffQuery.data ?? []

  return (
    <div className="space-y-4">
      {message ? (
        <Card className="border-border/80 bg-card px-4 py-3 text-sm shadow-sm">
          <p role="status">{message}</p>
        </Card>
      ) : null}
      {error ? <QueryError message={error} /> : null}

      <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-bold">RallyHub Staff</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Deleting clients, changing plans, marking invoices paid and managing this list
              stay with the owner regardless of role.
            </p>
          </div>
          <NeoButton type="button" variant="accent" onClick={() => setAddOpen(true)}>
            Add Staff
          </NeoButton>
        </div>

        <ul className="divide-border divide-y">
          {staff.map((member) => {
            const isSelf = member.id === profile?.id
            const role = member.staff_role ?? 'owner'
            const name =
              [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {name}
                    {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    @{member.username} · {ROLE_HELP[role]}
                  </p>
                </div>
                {role === 'owner' ? (
                  <NeoStatusBadge tone="ready">Owner</NeoStatusBadge>
                ) : (
                  <>
                    <select
                      aria-label={`Role for ${name}`}
                      value={role}
                      disabled={act.isPending}
                      onChange={(e) => void handleRoleChange(member, e.target.value as StaffRole)}
                      className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                    >
                      {ASSIGNABLE.map((r) => (
                        <option key={r} value={r}>
                          {STAFF_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <NeoButton
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={act.isPending}
                      onClick={() => setPendingRemove(member)}
                    >
                      Remove
                    </NeoButton>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Add staff member"
          onClick={() => setAddOpen(false)}
        >
          <Card
            className="border-border/80 bg-card w-full max-w-lg space-y-4 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-foreground text-sm font-bold">Add staff member</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <NeoLabel htmlFor="staff-first">First name</NeoLabel>
                <NeoInput
                  id="staff-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="staff-last">Last name</NeoLabel>
                <NeoInput
                  id="staff-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="staff-username">Username</NeoLabel>
                <NeoInput
                  id="staff-username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="lowercase, no spaces"
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="staff-email">Email</NeoLabel>
                <NeoInput
                  id="staff-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="staff-password">Temporary password</NeoLabel>
                <NeoInput
                  id="staff-password"
                  type="text"
                  autoComplete="off"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="They change it on first login"
                />
              </div>
              <div className="space-y-1.5">
                <NeoLabel htmlFor="staff-role">Role</NeoLabel>
                <select
                  id="staff-role"
                  value={form.staffRole}
                  onChange={(e) => setForm((f) => ({ ...f, staffRole: e.target.value as StaffRole }))}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  {ASSIGNABLE.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{ROLE_HELP[form.staffRole]}</p>
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" onClick={() => setAddOpen(false)}>
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="accent"
                disabled={act.isPending}
                onClick={() => void handleCreate()}
              >
                {act.isPending ? 'Adding…' : 'Add Staff'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}

      {pendingRemove ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
        >
          <Card className="border-border/80 bg-card w-full max-w-sm space-y-4 p-6 shadow-2xl">
            <h3 className="text-foreground font-semibold">
              Remove {[pendingRemove.first_name, pendingRemove.last_name].filter(Boolean).join(' ') || pendingRemove.username}?
            </h3>
            <p className="text-muted-foreground text-sm">
              Their login is deleted immediately. Nothing they worked on is affected.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" onClick={() => setPendingRemove(null)}>
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={act.isPending}
                onClick={() => void handleRemove()}
              >
                {act.isPending ? 'Removing…' : 'Remove'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
