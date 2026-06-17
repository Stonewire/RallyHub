import { ArrowLeft, MessageCircle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { FacilitatorButton } from '@/components/admin/FacilitatorButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIncomingChatSound } from '@/hooks/use-chat-notifications'
import { isTeamToFacilitatorChatMessage } from '@/lib/chat-notifications'
import type { Tables } from '@/types/helpers'

/** Per-team unread + sound for the facilitator inbox. */
export function useFacilitatorChatInbox(
  messages: Tables<'chat_messages'>[],
  facilitatorName: string,
  chatOpen: boolean,
  activeTeamId: string | null,
  chatHistoryReady: boolean,
  onNewMessageSound?: () => void,
) {
  const lastReadAtByTeamRef = useRef<Map<string, number>>(new Map())
  const [readEpoch, setReadEpoch] = useState(0)

  const markTeamRead = useCallback((teamId: string) => {
    lastReadAtByTeamRef.current.set(teamId, Date.now())
    setReadEpoch((e) => e + 1)
  }, [])

  // Viewing a thread marks that team read; new messages while in-thread stay read.
  useEffect(() => {
    if (chatOpen && activeTeamId) markTeamRead(activeTeamId)
  }, [chatOpen, activeTeamId, messages.length, markTeamRead])

  const trimmedName = facilitatorName.trim()

  const unreadByTeamId = useMemo(() => {
    const map = new Map<string, number>()
    if (!trimmedName) return map
    for (const m of messages) {
      if (!m.team_id) continue
      if (!isTeamToFacilitatorChatMessage(m, trimmedName)) continue
      const lastRead = lastReadAtByTeamRef.current.get(m.team_id) ?? 0
      if (new Date(m.created_at).getTime() > lastRead) {
        map.set(m.team_id, (map.get(m.team_id) ?? 0) + 1)
      }
    }
    return map
  }, [messages, trimmedName, readEpoch])

  const totalUnread = useMemo(() => {
    let sum = 0
    for (const n of unreadByTeamId.values()) sum += n
    return sum
  }, [unreadByTeamId])

  const incomingForSound = useMemo(() => {
    if (!trimmedName) return []
    return messages.filter((m) => {
      if (!m.team_id) return false
      if (!isTeamToFacilitatorChatMessage(m, trimmedName)) return false
      if (chatOpen && activeTeamId === m.team_id) return false
      return true
    })
  }, [messages, trimmedName, chatOpen, activeTeamId])

  useIncomingChatSound(incomingForSound, chatHistoryReady, onNewMessageSound)

  return { totalUnread, unreadByTeamId, markTeamRead }
}

/** @deprecated Use useFacilitatorChatInbox */
export function useFacilitatorChatUnread(
  messages: Tables<'chat_messages'>[],
  chatOpen: boolean,
  facilitatorName: string,
) {
  const { totalUnread } = useFacilitatorChatInbox(
    messages,
    facilitatorName,
    chatOpen,
    null,
    true,
  )
  return totalUnread
}

function lastThreadMessage(
  messages: Tables<'chat_messages'>[],
  teamId: string,
): Tables<'chat_messages'> | null {
  let last: Tables<'chat_messages'> | null = null
  for (const m of messages) {
    if (m.team_id === teamId) last = m
  }
  return last
}

function sortTeamsForInbox(
  teams: Tables<'teams'>[],
  messages: Tables<'chat_messages'>[],
  unreadByTeamId: Map<string, number>,
): Tables<'teams'>[] {
  const named = teams.filter((t) => t.name?.trim())

  const activityAt = (teamId: string) => {
    const last = lastThreadMessage(messages, teamId)
    return last ? new Date(last.created_at).getTime() : 0
  }

  return [...named].sort((a, b) => {
    const ua = unreadByTeamId.get(a.id) ?? 0
    const ub = unreadByTeamId.get(b.id) ?? 0
    const aUnread = ua > 0
    const bUnread = ub > 0
    if (aUnread && !bUnread) return -1
    if (bUnread && !aUnread) return 1
    if (ua !== ub) return ub - ua

    const ta = activityAt(a.id)
    const tb = activityAt(b.id)
    if (ta !== tb) return tb - ta

    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
  })
}

export function FacilitatorChatBubble({
  unreadCount,
  disabled = false,
  onClick,
}: {
  unreadCount: number
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <FacilitatorButton
      type="button"
      disabled={disabled}
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
  unreadByTeamId: Map<string, number>
  sendDisabled?: boolean
  onSend: (message: string, teamId: string) => Promise<void>
}

export function FacilitatorChatDrawer({
  open,
  onOpenChange,
  activeTeamId,
  onActiveTeamIdChange,
  messages,
  teams,
  unreadByTeamId,
  sendDisabled = false,
  onSend,
}: FacilitatorChatDrawerProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  const safeTeams = useMemo(
    () => teams.filter((t): t is Tables<'teams'> => Boolean(t?.id)),
    [teams],
  )

  const teamById = useMemo(
    () => new Map(safeTeams.map((t) => [t.id, t])),
    [safeTeams],
  )

  const sortedTeams = useMemo(
    () => sortTeamsForInbox(safeTeams, messages, unreadByTeamId),
    [safeTeams, messages, unreadByTeamId],
  )

  const threadMessages = useMemo(() => {
    if (!activeTeamId) return []
    return messages.filter((m) => m.team_id === activeTeamId)
  }, [messages, activeTeamId])

  const activeTeam = activeTeamId ? teamById.get(activeTeamId) : null

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

  function closeDrawer() {
    onActiveTeamIdChange(null)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 sm:p-4">
      <div className="border-border/80 ml-auto flex h-[min(520px,85vh)] w-full max-w-md flex-col rounded-t-xl border bg-card shadow-xl sm:rounded-xl">
        <div className="border-border/80 flex items-center gap-2 border-b px-3 py-3">
          {activeTeamId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Back to team list"
              onClick={() => onActiveTeamIdChange(null)}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{activeTeamId ? activeTeam?.name?.trim() || 'Team' : 'Team chat'}</p>
            <p className="text-muted-foreground truncate text-xs">
              {activeTeamId ? 'Conversation with team' : 'Select a team to view messages'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={closeDrawer}>
            <X className="size-4" />
          </Button>
        </div>

        {!activeTeamId ? (
          <ul className="flex-1 overflow-auto p-2">
            {sortedTeams.length === 0 ? (
              <li className="text-muted-foreground px-3 py-8 text-center text-sm">
                No teams have joined yet.
              </li>
            ) : (
              sortedTeams.map((t) => {
                const unread = unreadByTeamId.get(t.id) ?? 0
                const last = lastThreadMessage(messages, t.id)
                const preview = last
                  ? `${last.sender}: ${last.message}`
                  : 'No messages yet'

                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                      onClick={() => onActiveTeamIdChange(t.id)}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-1 ring-border"
                        style={{ background: t.color ?? '#888' }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{preview}</p>
                      </div>
                      {unread > 0 ? (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })
            )}
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
                placeholder={
                  sendDisabled ? 'Controls disabled until event is live' : 'Message team…'
                }
                className="bg-background"
                disabled={sendDisabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send()
                }}
              />
              <FacilitatorButton
                type="button"
                size="sm"
                disabled={sendDisabled}
                onClick={() => void send()}
              >
                Send
              </FacilitatorButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
