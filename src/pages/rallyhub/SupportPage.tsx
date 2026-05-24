import { useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  useReplyToTicket,
  useSupportTickets,
  useUpdateTicketStatus,
} from '@/hooks/use-rallyhub'

export function RallyHubSupportPage() {
  const { data, isLoading, isError, error } = useSupportTickets()
  const updateStatus = useUpdateTicketStatus()
  const reply = useReplyToTicket()
  const [replyText, setReplyText] = useState<Record<string, string>>({})

  return (
    <AdminPageShell
      title="Support"
      subtitle="Client support tickets across the platform."
    >
      {isLoading ? (
        <QueryLoading rows={5} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">No support tickets yet.</p>
      ) : (
        <ul className="space-y-4">
          {data?.map((ticket) => (
            <li key={ticket.id}>
              <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-semibold">{ticket.subject}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(ticket.created_at).toLocaleString()} · Org{' '}
                      {ticket.organization_id.slice(0, 8)}…
                    </p>
                  </div>
                  <select
                    value={ticket.status}
                    className="border-input rounded-lg border px-2 py-1 text-sm"
                    onChange={(e) =>
                      void updateStatus.mutateAsync({
                        ticketId: ticket.id,
                        status: e.target.value,
                      })
                    }
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                {ticket.body ? (
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {ticket.body}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label>Reply</Label>
                  <textarea
                    value={replyText[ticket.id] ?? ''}
                    onChange={(e) =>
                      setReplyText((r) => ({ ...r, [ticket.id]: e.target.value }))
                    }
                    rows={3}
                    className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!replyText[ticket.id]?.trim()}
                    onClick={() => {
                      const body = replyText[ticket.id]?.trim()
                      if (!body) return
                      void reply.mutateAsync({ ticketId: ticket.id, body })
                      setReplyText((r) => ({ ...r, [ticket.id]: '' }))
                    }}
                  >
                    Send reply
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AdminPageShell>
  )
}
