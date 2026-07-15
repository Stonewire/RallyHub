import { useEffect, useRef } from 'react'

type ParticipantBingoNoticeProps = {
  durationMs?: number
  onDismiss: () => void
}

/** Static winner acknowledgement for the winning participant's phone. */
export function ParticipantBingoNotice({
  durationMs = 6000,
  onDismiss,
}: ParticipantBingoNoticeProps) {
  const onDismissRef = useRef(onDismiss)
  // eslint-disable-next-line react-hooks/refs -- keep the timeout callback fresh without restarting it
  onDismissRef.current = onDismiss

  useEffect(() => {
    const timer = window.setTimeout(() => onDismissRef.current(), durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs])

  return (
    <button
      type="button"
      className="experience-scope fixed inset-0 z-[10060] flex cursor-default items-center justify-center bg-black px-6 text-center text-white"
      onClick={onDismiss}
      aria-label="Bingo! Tap to close"
    >
      <span className="font-sans text-7xl font-black tracking-wide sm:text-9xl">
        BINGO!
      </span>
    </button>
  )
}
