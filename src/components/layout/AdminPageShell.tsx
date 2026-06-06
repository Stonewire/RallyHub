import type { ReactNode } from 'react'

import { NeoPageShell } from '@/components/neo-minimal'

type AdminPageShellProps = {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  backTo?: string
  backLabel?: string
  className?: string
}

/** Centered responsive content column for admin pages (neo-minimal). */
export function AdminPageShell(props: AdminPageShellProps) {
  return <NeoPageShell {...props} />
}
