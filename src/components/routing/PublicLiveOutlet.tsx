import type { ReactNode } from 'react'

/** Pass-through layout for public live routes (no auth). */
export function PublicLiveOutlet({ children }: { children: ReactNode }) {
  return <>{children}</>
}
