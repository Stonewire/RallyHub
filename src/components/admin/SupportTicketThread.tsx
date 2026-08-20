import { IconDownload, IconSend } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Label } from '@/components/ui/label'
import {
  useMarkSupportTicketRead,
  useSendTicketMessage,
  useTicketMessages,
  type SupportTicketRow,
  type SupportViewerRole,
} from '@/hooks/use-support-tickets'
import { cn } from '@/lib/utils'

type SupportTicketThreadProps = {
  ticket: SupportTicketRow
  senderRole: SupportViewerRole
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
  const { t } = useTranslation('admin')
  const { data: messages, isLoading, isError, error } = useTicketMessages(ticket.id)
  const sendMessage = useSendTicketMessage()
  const { mutate: markTicketRead } = useMarkSupportTicketRead()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    markTicketRead({ ticketId: ticket.id, viewerRole: senderRole })
  }, [ticket.id, senderRole, markTicketRead])

  const lastMessage = messages?.[messages.length - 1]
  useEffect(() => {
    if (!lastMessage || lastMessage.sender_role === senderRole) return
    markTicketRead({ ticketId: ticket.id, viewerRole: senderRole })
  }, [lastMessage?.id, ticket.id, senderRole, markTicketRead, lastMessage])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages?.length, ticket.id])

  function handleExport() {
    const lines = (messages ?? []).map(
      (m) => `[${formatMessageTime(m.created_at)}] ${m.sender_name}: ${m.body}`,
    )
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${ticket.ticket_number ?? ticket.id}-transcript.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

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
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {ticket.ticket_number ? t('support.ref', { number: ticket.ticket_number }) : null}
        </p>
        <NeoButton
          type="button"
          variant="surface"
          size="sm"
          disabled={!messages?.length}
          onClick={handleExport}
        >
          <IconDownload className="size-3.5" aria-hidden />
          {t('support.export')}
        </NeoButton>
      </div>

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
          <p className="text-muted-foreground p-4 text-sm">{t('support.noMessages')}</p>
        ) : (
          <ul ref={listRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m) => {
              const isMine = m.sender_role === senderRole
              return (
                <li
                  key={m.id}
                  className={cn('flex flex-col gap-1', isMine ? 'items-end' : 'items-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                      isMine
                        ? 'rounded-br-md bg-[#0A84FF] text-white'
                        : 'bg-primary text-primary-foreground rounded-bl-md',
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
        <Label htmlFor={`reply-${ticket.id}`} className="sr-only">
          {t('support.reply')}
        </Label>
        <div className="border-border bg-card flex items-end gap-2 rounded-2xl border p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
        <textarea
          id={`reply-${ticket.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none"
          placeholder={t('support.messagePlaceholder')}
          onKeyDown={(e) => {
            // Plain Enter sends, matching the design's chat-input pattern;
            // Shift+Enter still inserts a newline for longer replies.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <NeoButton
          type="button"
          variant="primary"
          size="sm"
          className="mb-0.5 shrink-0 rounded-xl"
          disabled={!draft.trim() || sendMessage.isPending}
          onClick={() => void handleSend()}
        >
          <IconSend className="size-3.5" />
          {sendMessage.isPending ? t('support.sending') : t('support.send')}
        </NeoButton>
        </div>
      </div>
    </div>
  )
}
