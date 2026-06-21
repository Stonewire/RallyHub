import { useState } from 'react'

import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { SupportTicketsWorkspace } from '@/components/admin/SupportTicketsWorkspace'
import { SupportTicketThread } from '@/components/admin/SupportTicketThread'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoButton, NeoCard, NeoInput, NeoLabel, NeoTextarea } from '@/components/neo-minimal'
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
        <NeoButton
          type="button"
          variant={showNewForm ? 'primary' : 'surface'}
          onClick={() => {
            setShowNewForm(true)
            setSelectedId(null)
          }}
        >
          New ticket
        </NeoButton>
        {tickets.length > 0 ? (
          <NeoButton
            type="button"
            variant={!showNewForm && selected ? 'primary' : 'surface'}
            onClick={() => {
              setShowNewForm(false)
              if (!selectedId && tickets[0]) setSelectedId(tickets[0].id)
            }}
          >
            My tickets ({tickets.length})
          </NeoButton>
        ) : null}
      </div>

      {error ? <QueryError message={error} /> : null}

      {showNewForm ? (
        <NeoCard className="mb-6 max-w-xl space-y-4 p-6">
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <NeoLabel htmlFor="support-subject">Subject</NeoLabel>
              <NeoInput
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-background"
                required
              />
            </div>
            <div className="space-y-2">
              <NeoLabel htmlFor="support-body">Details</NeoLabel>
              <NeoTextarea
                id="support-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full resize-y bg-background"
                placeholder="What happened? Steps to reproduce, event name, etc."
                required
              />
            </div>
            <NeoButton type="submit" variant="primary" disabled={createTicket.isPending}>
              {createTicket.isPending ? 'Submitting…' : 'Submit ticket'}
            </NeoButton>
          </form>
        </NeoCard>
      ) : null}

      {!showNewForm ? (
        ticketsQuery.isLoading ? (
          <QueryLoading rows={4} />
        ) : tickets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tickets yet. Submit one above.</p>
        ) : (
          <SupportTicketsWorkspace
            tickets={tickets}
            selectedId={selectedId}
            onSelectTicket={setSelectedId}
            senderRole="client"
            emptyMessage="No tickets yet. Submit one above."
          />
        )
      ) : selected ? (
        <NeoCard className="max-w-2xl space-y-4 p-4 sm:p-5">
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
        </NeoCard>
      ) : null}
    </AdminPageShell>
  )
}
