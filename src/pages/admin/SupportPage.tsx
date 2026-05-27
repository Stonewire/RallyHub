import { useState } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import {
  NoOrganizationMessage,
  QueryError,
} from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { generateSupportTicketNumber } from '@/lib/support-ticket'
import { supabase } from '@/lib/supabase'

export function AdminSupportPage() {
  const organizationId = useOrganizationId()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !subject.trim()) {
      setError('Subject is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    setTicketNumber(null)
    try {
      const number = generateSupportTicketNumber()
      const { error: insertError } = await supabase.from('support_tickets').insert({
        organization_id: organizationId,
        subject: subject.trim(),
        body: body.trim() || null,
        ticket_number: number,
        status: 'open',
      })
      if (insertError) throw insertError
      setTicketNumber(number)
      setSubject('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit ticket')
    } finally {
      setSubmitting(false)
    }
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Support" subtitle="Submit a ticket to the RallyHub team.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="Support"
      subtitle="Describe your issue and we will follow up. Save your ticket number for reference."
    >
      {ticketNumber ? (
        <Card className="border-border/80 mb-6 space-y-2 bg-card p-6 shadow-sm">
          <p className="text-foreground font-medium">Ticket submitted</p>
          <p className="text-muted-foreground text-sm">
            Your reference number (include this in any follow-up):
          </p>
          <p className="font-mono text-lg font-semibold tracking-wide">{ticketNumber}</p>
        </Card>
      ) : null}

      {error ? <QueryError message={error} /> : null}

      <Card className="border-border/80 max-w-xl space-y-4 bg-card p-6 shadow-sm">
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-background"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-body">Details</Label>
            <textarea
              id="support-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="What happened? Steps to reproduce, event name, etc."
            />
          </div>
          <AccentButton type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit ticket'}
          </AccentButton>
        </form>
      </Card>
    </AdminPageShell>
  )
}
