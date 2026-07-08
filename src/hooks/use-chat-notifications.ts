import { useEffect, useRef, useState } from 'react'

type IncomingMessage = { id: string }

/**
 * Tracks unread incoming chat messages and fires onNew when new IDs appear.
 * Only seeds the seen set after chatHistoryReady (initial fetch complete) so
 * realtime inserts before history loads do not mark live messages as seen.
 */
export function useIncomingChatAlerts(
  incoming: IncomingMessage[],
  chatOpen: boolean,
  chatHistoryReady: boolean,
  onNew?: () => void,
): number {
  const seenIdsRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the chatOpen prop transitioning true
    if (chatOpen) setUnread(0)
  }, [chatOpen])

  useEffect(() => {
    if (!chatHistoryReady) return

    if (!seededRef.current) {
      for (const m of incoming) seenIdsRef.current.add(m.id)
      seededRef.current = true
      return
    }

    let newCount = 0
    for (const m of incoming) {
      if (seenIdsRef.current.has(m.id)) continue
      seenIdsRef.current.add(m.id)
      newCount++
      onNew?.()
    }

    if (newCount > 0 && !chatOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to new incoming realtime chat messages, an external system
      setUnread((n) => n + newCount)
    }
  }, [incoming, chatOpen, chatHistoryReady, onNew])

  return unread
}

/** Sound-only variant for pages that use a separate unread badge counter. */
export function useIncomingChatSound(
  incoming: IncomingMessage[],
  chatHistoryReady: boolean,
  onNew?: () => void,
): void {
  const seenIdsRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)

  useEffect(() => {
    if (!chatHistoryReady) return

    if (!seededRef.current) {
      for (const m of incoming) seenIdsRef.current.add(m.id)
      seededRef.current = true
      return
    }

    for (const m of incoming) {
      if (seenIdsRef.current.has(m.id)) continue
      seenIdsRef.current.add(m.id)
      onNew?.()
    }
  }, [incoming, chatHistoryReady, onNew])
}
