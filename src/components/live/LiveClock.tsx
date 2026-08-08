import { useLiveTimer } from '@/hooks/use-live-timer'

/**
 * A ticking countdown in its own component, so the 1Hz tick re-renders this
 * one <p> and nothing else. When the tick state lived in JoinGameView, every
 * second re-rendered the entire player surface for the whole event — the
 * choppy scrolling and laggy taps on phones (CF5, 8 Aug evening).
 */
export function LiveClock({
  seconds,
  running,
  render,
  className,
}: {
  seconds: number
  running: boolean
  render: (secondsLeft: number) => string
  className?: string
}) {
  const display = useLiveTimer(seconds, running, () => {})
  return <p className={className}>{render(display)}</p>
}
