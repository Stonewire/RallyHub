const SYNC_INTERVAL_MS = 3000

export function createThrottledTimerSync(
  onWrite: (next: number, stillRunning: boolean) => void | Promise<void>,
) {
  let lastWrite = 0

  return (next: number, stillRunning: boolean) => {
    const now = Date.now()
    const shouldWrite =
      next === 0 ||
      !stillRunning ||
      now - lastWrite >= SYNC_INTERVAL_MS

    if (shouldWrite) {
      lastWrite = now
      void onWrite(next, stillRunning)
    }
  }
}
