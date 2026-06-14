import { useEffect, useRef, useState } from 'react'

/**
 * Tracks unread incoming chat messages and fires onNew when new IDs appear.
 * Waits for messagesLoaded before seeding so an empty initial fetch does not
 * mark every historical message as new.
 */
export function useIncomingChatNotifications(
  incomingIds: string[],
  chatOpen: boolean,
  messagesLoaded: boolean,
  onNew?: () => void,
): number {
  const seenRef = useRef<Set<string> | null>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (chatOpen) setUnread(0)
  }, [chatOpen])

  useEffect(() => {
    if (!messagesLoaded) return

    if (seenRef.current === null) {
      seenRef.current = new Set(incomingIds)
      return
    }

    let newCount = 0
    for (const id of incomingIds) {
      if (seenRef.current.has(id)) continue
      seenRef.current.add(id)
      newCount++
      onNew?.()
    }

    if (newCount > 0 && !chatOpen) {
      setUnread((n) => n + newCount)
    }
  }, [incomingIds, chatOpen, messagesLoaded, onNew])

  return unread
}
