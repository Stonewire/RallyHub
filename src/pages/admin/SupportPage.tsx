import { useState } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { SupportTicketCard } from '@/components/admin/SupportTicketCard'
import { SupportTicketThread } from '@/components/admin/SupportTicketThread'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateSupportTicket,
  useSupportTickets,
} from '@/hooks/use-support-tickets'
import { useOrganizationId } from '@/hooks/use-organization-id'

export function AdminSupportPage() {
  const organizationId = useOrganizationId()
  const orgId = organizationId ?? undefined
  const ticketsQuery = useSupportTickets('org', orgId)
  const createTicket = useCreateSupportTicket(orgId)

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(true)

  const tickets = ticketsQuery.data ?? []
  const selected = tickets.find((t) => t.id === selectedId) ?? null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !subject.trim()) {
      setError('Subject is required.')
      return
    }
    if (!body.trim()) {
      setError('Please describe your issue.')
      return
    }
    setError(null)
    try {
      const { ticket } = await createTicket.mutateAsync({
        subject: subject.trim(),
        body: body.trim(),
      })
      setSubject('')
      setBody('')
      setShowNewForm(false)
      setSelectedId(ticket.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit ticket')
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
      subtitle="Submit a ticket or continue an existing conversation with RallyHub support."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <AccentButton
          type="button"
          variant={showNewForm ? 'default' : 'outline'}
          onClick={() => {
            setShowNewForm(true)
            setSelectedId(null)
          }}
        >
          New ticket
        </AccentButton>
        {tickets.length > 0 ? (
          <AccentButton
            type="button"
            variant={!showNewForm && selected ? 'default' : 'outline'}
            onClick={() => {
              setShowNewForm(false)
              if (!selectedId && tickets[0]) setSelectedId(tickets[0].id)
            }}
          >
            My tickets ({tickets.length})
          </AccentButton>
        ) : null}
      </div>

      {error ? <QueryError message={error} /> : null}

      {showNewForm ? (
        <Card className="border-border/80 mb-6 max-w-xl space-y-4 bg-card p-6 shadow-sm">
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
                required
              />
            </div>
            <AccentButton type="submit" disabled={createTicket.isPending}>
              {createTicket.isPending ? 'Submitting…' : 'Submit ticket'}
            </AccentButton>
          </form>
        </Card>
      ) : null}

      {!showNewForm ? (
        ticketsQuery.isLoading ? (
          <QueryLoading rows={4} />
        ) : tickets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tickets yet. Submit one above.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {tickets.map((ticket) => (
                <SupportTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  selected={ticket.id === selectedId}
                  onClick={() => setSelectedId(ticket.id)}
                />
              ))}
            </div>
            {selected ? (
              <Card className="border-border/80 space-y-4 bg-card p-4 shadow-sm sm:p-5">
                <div>
                  <p className="text-foreground font-semibold">{selected.subject}</p>
                  {selected.ticket_number ? (
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                      {selected.ticket_number}
                    </p>
                  ) : null}
                </div>
                <SupportTicketThread ticket={selected} senderRole="client" />
              </Card>
            ) : (
              <p className="text-muted-foreground text-sm">Select a ticket to view the thread.</p>
            )}
          </div>
        )
      ) : selected ? (
        <Card className="border-border/80 max-w-2xl space-y-4 bg-card p-4 shadow-sm sm:p-5">
          <div>
            <p className="text-foreground font-medium">Ticket submitted</p>
            {selected.ticket_number ? (
              <p className="text-muted-foreground mt-1 text-sm">
                Reference:{' '}
                <span className="font-mono font-semibold">{selected.ticket_number}</span>
              </p>
            ) : null}
          </div>
          <SupportTicketThread ticket={selected} senderRole="client" />
        </Card>
      ) : null}
    </AdminPageShell>
  )
}
