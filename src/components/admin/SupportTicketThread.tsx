import { useEffect, useRef, useState } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { Label } from '@/components/ui/label'
import {
  useSendTicketMessage,
  useTicketMessages,
  type SupportTicketRow,
} from '@/hooks/use-support-tickets'
import { cn } from '@/lib/utils'

type SupportTicketThreadProps = {
  ticket: SupportTicketRow
  senderRole: 'client' | 'support'
  senderName?: string
  className?: string
}

function formatMessageTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function SupportTicketThread({
  ticket,
  senderRole,
  senderName,
  className,
}: SupportTicketThreadProps) {
  const { data: messages, isLoading, isError, error } = useTicketMessages(ticket.id)
  const sendMessage = useSendTicketMessage()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages?.length, ticket.id])

  async function handleSend() {
    const body = draft.trim()
    if (!body || sendMessage.isPending) return
    await sendMessage.mutateAsync({
      ticketId: ticket.id,
      body,
      senderRole,
      senderName,
    })
    setDraft('')
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="border-border/80 bg-muted/20 min-h-[14rem] rounded-lg border">
        {isLoading ? (
          <div className="p-4">
            <QueryLoading rows={3} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <QueryError message={error?.message} />
          </div>
        ) : !messages?.length ? (
          <p className="text-muted-foreground p-4 text-sm">No messages yet.</p>
        ) : (
          <ul ref={listRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m) => {
              const isSupport = m.sender_role === 'support'
              return (
                <li
                  key={m.id}
                  className={cn('flex flex-col gap-1', isSupport ? 'items-end' : 'items-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                      isSupport
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border-border/80 border rounded-bl-md',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                  <span className="text-muted-foreground px-1 text-[11px]">
                    {m.sender_name} · {formatMessageTime(m.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`reply-${ticket.id}`}>Reply</Label>
        <textarea
          id={`reply-${ticket.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Write a message…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <AccentButton
          type="button"
          disabled={!draft.trim() || sendMessage.isPending}
          onClick={() => void handleSend()}
        >
          {sendMessage.isPending ? 'Sending…' : 'Send reply'}
        </AccentButton>
      </div>
    </div>
  )
}
