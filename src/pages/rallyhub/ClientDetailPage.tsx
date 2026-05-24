import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useRallyHubClient, useUpdateClientNotes } from '@/hooks/use-rallyhub'
import { supabase } from '@/lib/supabase'

export function RallyHubClientDetailPage() {
  const { clientId } = useParams()
  const { data, isLoading, isError, error } = useRallyHubClient(clientId)
  const updateNotes = useUpdateClientNotes()
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (data?.org) {
      setNotes(data.org.internal_notes ?? '')
    }
  }, [data?.org])

  async function forcePasswordReset(userId: string) {
    const pw = window.prompt('New password for user')
    if (!pw) return
    const { error: err } = await supabase.auth.admin.updateUserById(userId, {
      password: pw,
    })
    if (err) alert('Requires service role: ' + err.message)
    else alert('Password updated (if admin API is configured).')
  }

  async function sendResetEmail(email: string) {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email)
    if (err) alert(err.message)
    else alert('Password reset email sent.')
  }

  if (isLoading) {
    return (
      <AdminPageShell title="Client">
        <QueryLoading rows={4} />
      </AdminPageShell>
    )
  }

  if (isError || !data) {
    return (
      <AdminPageShell title="Client">
        <QueryError message={error?.message ?? 'Not found'} />
      </AdminPageShell>
    )
  }

  const org = data.org

  return (
    <AdminPageShell title={org.name} subtitle="Client organization details.">
      <div className="space-y-6">
        <Card className="border-border/80 space-y-3 bg-card p-6 shadow-sm">
          <p className="text-muted-foreground text-sm">
            Plan: <span className="text-foreground capitalize">{org.billing_plan}</span>
          </p>
          <p className="text-muted-foreground text-sm">
            Events: {data.events.length} total
          </p>
        </Card>

        <Card className="border-border/80 bg-card p-6 shadow-sm">
          <h3 className="text-foreground mb-4 font-semibold">Team members</h3>
          <ul className="space-y-3">
            {data.profiles.map((p) => (
              <li
                key={p.id}
                className="border-border/80 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{p.full_name || p.id}</p>
                  <p className="text-muted-foreground text-xs capitalize">{p.role}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void forcePasswordReset(p.id)}
                  >
                    Force reset
                  </Button>
                </div>
              </li>
            ))}
            {data.members.map((m) => (
              <li key={m.id} className="text-muted-foreground text-sm">
                {m.email} (invited)
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => void sendResetEmail(m.email)}
                >
                  Send reset email
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-border/80 space-y-3 bg-card p-6 shadow-sm">
          <Label>Internal notes</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
          />
        </Card>
      </div>

      <FormSaveFooter
        label="Save notes"
        saving={updateNotes.isPending}
        onSave={() => {
          if (!clientId) return
          void updateNotes.mutateAsync({ orgId: clientId, notes })
        }}
      />
    </AdminPageShell>
  )
}
