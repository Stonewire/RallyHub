import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Paperclip } from 'lucide-react'

import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { SupportTicketsWorkspace } from '@/components/admin/SupportTicketsWorkspace'
import { SupportTicketThread } from '@/components/admin/SupportTicketThread'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import {
  NeoButton,
  NeoCard,
  NeoInput,
  NeoLabel,
  NeoTextarea,
  SegmentedPill,
} from '@/components/neo-minimal'
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
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)
  // A ?ticket= id (from global search) selects that ticket and opens the
  // My Tickets view, so a search hit lands on the conversation itself rather
  // than on an empty New Ticket form.
  const [searchParams] = useSearchParams()
  const requestedTicketId = searchParams.get('ticket')

  const [selectedId, setSelectedId] = useState<string | null>(requestedTicketId)
  const [showNewForm, setShowNewForm] = useState(!requestedTicketId)

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
        body: category ? `Category: ${category}\n\n${body.trim()}` : body.trim(),
      })
      setSubject('')
      setBody('')
      setCategory('')
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
      subtitle="If you have any issues or questions, our support team will get back to you within 24 hours."
      centeredHeader
    >
      <div className="mx-auto mb-6 w-fit min-w-72">
        <SegmentedPill
          aria-label="Support view"
          options={[
            { value: 'new', label: 'New Ticket' },
            {
              value: 'mine',
              label: `My Tickets${tickets.length > 0 ? ` (${tickets.length})` : ''}`,
            },
          ]}
          value={showNewForm ? 'new' : 'mine'}
          onChange={(next) => {
            if (next === 'new') {
              setShowNewForm(true)
              setSelectedId(null)
              return
            }
            setShowNewForm(false)
            if (!selectedId && tickets[0]) setSelectedId(tickets[0].id)
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-[1100px]">
      {error ? <div className="mb-4"><QueryError message={error} /></div> : null}

      {showNewForm ? (
        <NeoCard className="mx-auto mb-6 max-w-[520px] space-y-4 p-4">
          <div>
            <h2 className="text-foreground text-sm font-bold">Open a Case</h2>
            <p className="text-muted-foreground mt-1 text-xs">Our specialised team will respond within 24 hours.</p>
          </div>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-1.5">
              <NeoLabel htmlFor="support-subject">Subject</NeoLabel>
              <NeoInput
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-background"
                placeholder="Briefly describe the issue…"
                required
              />
            </div>
            <div className="space-y-1.5">
              <NeoLabel htmlFor="support-category">Category</NeoLabel>
              <select
                id="support-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-9 w-full px-3 text-sm"
                required
              >
                <option value="">Select Category</option>
                <option value="Billing">Billing</option>
                <option value="Technical">Technical</option>
                <option value="Account">Account</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <NeoLabel htmlFor="support-body">Details</NeoLabel>
              <NeoTextarea
                id="support-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full resize-y bg-background"
                placeholder="Provide as much context as possible. Include steps to reproduce the issue if applicable…"
                required
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <NeoButton type="button" variant="ghost" disabled title="Ticket attachments are not available yet">
                <Paperclip className="size-4" />
                Upload a File
              </NeoButton>
              <NeoButton type="submit" variant="primary" disabled={createTicket.isPending}>
                {createTicket.isPending ? 'Submitting…' : 'Submit'}
              </NeoButton>
            </div>
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
      </div>
    </AdminPageShell>
  )
}
