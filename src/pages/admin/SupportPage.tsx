import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconAttachment } from '@/components/icons'

import {
  ALLOWED_ATTACHMENT_UPLOAD_TYPES,
  validateAttachmentUpload,
} from '@/lib/upload-limits'

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
  const [files, setFiles] = useState<File[]>([])
  const attachInput = useRef<HTMLInputElement>(null)
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
        // Category has its own column now, so it is no longer prefixed into
        // the body where it polluted the first line and could not be filtered.
        body: body.trim(),
        category,
        files,
      })
      setSubject('')
      setBody('')
      setCategory('')
      setFiles([])
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
              <div className="min-w-0">
                <NeoButton
                  type="button"
                  variant="ghost"
                  onClick={() => attachInput.current?.click()}
                >
                  <IconAttachment className="size-4" />
                  Upload a File
                </NeoButton>
                <input
                  ref={attachInput}
                  type="file"
                  multiple
                  hidden
                  accept={ALLOWED_ATTACHMENT_UPLOAD_TYPES.join(',')}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? [])
                    // Checked here as well as by the bucket so an oversized or
                    // unsupported file is refused before anything is uploaded.
                    const rejected = picked
                      .map((file) => validateAttachmentUpload(file))
                      .find(Boolean)
                    if (rejected) {
                      setError(rejected)
                    } else {
                      setError(null)
                      setFiles((current) => [...current, ...picked])
                    }
                    e.target.value = ''
                  }}
                />
                {files.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="text-muted-foreground flex items-center gap-2 text-xs"
                      >
                        <span className="max-w-52 truncate">{file.name}</span>
                        <button
                          type="button"
                          className="hover:text-foreground underline"
                          onClick={() =>
                            setFiles((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
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
