import { IconClock, IconRestore } from '@/components/icons'
import { useEffect, useRef, useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { useNotification } from '@/contexts/notification-context'
import { useOptionalTenant } from '@/contexts/tenant-context'
import {
  fetchDemoSandboxState,
  formatDemoCountdown,
  resetDemoSandbox,
  type DemoSandboxState,
} from '@/lib/demo-sandbox'

export function DemoSandboxBar() {
  const tenant = useOptionalTenant()
  const { notify } = useNotification()
  const [state, setState] = useState<DemoSandboxState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [resetting, setResetting] = useState(false)
  const automaticResetStarted = useRef(false)
  const isDemo = tenant?.tenantOrg?.is_demo === true

  useEffect(() => {
    if (!isDemo) return
    let cancelled = false
    void fetchDemoSandboxState()
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch((error) => {
        if (!cancelled) {
          notify(error instanceof Error ? error.message : 'Could not load the demo timer.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [isDemo, notify])

  useEffect(() => {
    if (!isDemo) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [isDemo])

  const nextResetAt = state?.nextResetAt ?? tenant?.tenantOrg?.demo_reset_at ?? null
  const remaining = nextResetAt ? new Date(nextResetAt).getTime() - now : 0

  useEffect(() => {
    if (!isDemo || !state || remaining > 0 || automaticResetStarted.current) return
    automaticResetStarted.current = true
    setResetting(true)
    void resetDemoSandbox(false)
      .then(() => window.location.assign('/admin'))
      .catch((error) => {
        automaticResetStarted.current = false
        setResetting(false)
        notify(error instanceof Error ? error.message : 'Could not refresh the demo.')
      })
  }, [isDemo, notify, remaining, state])

  if (!isDemo) return null

  async function handleManualReset() {
    if (
      !window.confirm(
        'Reset the demo now? All changes, live teams, scores and billing choices will be restored to the showcase data.',
      )
    ) {
      return
    }

    setResetting(true)
    try {
      await resetDemoSandbox(true)
      window.location.assign('/admin')
    } catch (error) {
      setResetting(false)
      notify(error instanceof Error ? error.message : 'Could not reset the demo.')
    }
  }

  return (
    <div className="border-border/70 bg-card/95 sticky top-0 z-20 flex min-h-10 items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 font-semibold">
          Demo sandbox
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          Everything works normally. Changes are temporary.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
          <IconClock className="size-3.5" aria-hidden />
          {resetting
            ? 'Restoring…'
            : nextResetAt
              ? `Resets in ${formatDemoCountdown(remaining)}`
              : 'Loading timer…'}
        </span>
        <NeoButton
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={resetting}
          onClick={() => void handleManualReset()}
          title="Restore the original demo data"
        >
          <IconRestore className="size-3.5" aria-hidden />
          <span className="hidden md:inline">Reset now</span>
        </NeoButton>
      </div>
    </div>
  )
}
