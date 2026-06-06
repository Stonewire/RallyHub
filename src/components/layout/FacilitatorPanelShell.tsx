import type { ReactNode } from 'react'

import { LivePanelShell } from '@/components/layout/LivePanelShell'

type FacilitatorPanelShellProps = {
  title: string
  subtitle?: ReactNode
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  titleCentered?: boolean
}

/** Facilitator control panel with neo-minimal admin styling. */
export function FacilitatorPanelShell(props: FacilitatorPanelShellProps) {
  return (
    <div className="neo-minimal-scope neo-minimal-inset bg-background min-h-screen">
      <LivePanelShell {...props} />
    </div>
  )
}
