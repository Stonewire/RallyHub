import { MessageCircle, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { FacilitatorButton } from '@/components/admin/FacilitatorButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Tables } from '@/types/helpers'

export function useFacilitatorChatUnread(
  messages: Tables<'chat_messages'>[],
  chatOpen: boolean,
) {
  const [lastReadAt, setLastReadAt] = useState(() => Date.now())

  useEffect(() => {
    if (chatOpen) setLastReadAt(Date.now())
  }, [chatOpen, messages.length])

  return useMemo(() => {
    return messages.filter((m) => {
      if (!m.team_id) return false
      return new Date(m.created_at).getTime() > lastReadAt
    }).length
  }, [messages, lastReadAt])
}

export function FacilitatorChatBubble({
  unreadCount,
  onClick,
}: {
  unreadCount: number
  onClick: () => void
}) {
  return (
    <FacilitatorButton
      type="button"
      className="relative fixed bottom-4 right-4 z-40 size-12 rounded-full p-0 shadow-lg"
      onClick={onClick}
      aria-label="Open team chat"
    >
      <MessageCircle className="size-5" />
      {unreadCount > 0 ? (
        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </FacilitatorButton>
  )
}

type FacilitatorChatDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTeamId: string | null
  onActiveTeamIdChange: (teamId: string | null) => void
  messages: Tables<'chat_messages'>[]
  teams: Tables<'teams'>[]
  onSend: (message: string, teamId: string) => Promise<void>
}

export function FacilitatorChatDrawer({
  open,
  onOpenChange,
  activeTeamId,
  onActiveTeamIdChange,
  messages,
  teams,
  onSend,
}: FacilitatorChatDrawerProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  const threadMessages = useMemo(() => {
    if (!activeTeamId) return []
    return messages.filter((m) => m.team_id === activeTeamId)
  }, [messages, activeTeamId])

  useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [open, threadMessages.length, activeTeamId])

  async function send() {
    if (!activeTeamId) return
    const text = draft.trim()
    if (!text) return
    await onSend(text, activeTeamId)
    setDraft('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 sm:p-4">
      <div className="border-border/80 ml-auto flex h-[min(520px,85vh)] w-full max-w-md flex-col rounded-t-xl border bg-card shadow-xl sm:rounded-xl">
        <div className="border-border/80 flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">Team chat</p>
            <p className="text-muted-foreground truncate text-xs">
              {activeTeamId
                ? teamById.get(activeTeamId)?.name?.trim() || 'Team'
                : 'Pick a team'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>
        {!activeTeamId ? (
          <ul className="flex-1 overflow-auto p-2">
            {teams
              .filter((t) => t.name?.trim())
              .map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="hover:bg-muted/50 w-full rounded-lg px-3 py-2 text-left text-sm"
                    onClick={() => onActiveTeamIdChange(t.id)}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <>
            <ul ref={listRef} className="flex-1 space-y-2 overflow-auto p-4 text-sm">
              {threadMessages.length === 0 ? (
                <p className="text-muted-foreground text-center text-xs">No messages yet.</p>
              ) : (
                threadMessages.map((m) => (
                  <li key={m.id}>
                    <span className="font-medium">{m.sender}: </span>
                    {m.message}
                  </li>
                ))
              )}
            </ul>
            <div className="border-border/80 flex gap-2 border-t p-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message team…"
                className="bg-background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send()
                }}
              />
              <FacilitatorButton type="button" size="sm" onClick={() => void send()}>
                Send
              </FacilitatorButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
