import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const EVENTS_COLLAPSED_STORAGE_KEY = 'rallyhub-events-collapsed-v1'
export const SUPPORT_COLLAPSED_STORAGE_KEY = 'rallyhub-support-collapsed-v1'

// eslint-disable-next-line react-refresh/only-export-components -- companion helper for CollapsibleSection's persisted collapsed state
export function loadCollapsedState(
  storageKey = EVENTS_COLLAPSED_STORAGE_KEY,
): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- companion helper for CollapsibleSection's persisted collapsed state
export function saveCollapsedState(
  state: Record<string, boolean>,
  storageKey = EVENTS_COLLAPSED_STORAGE_KEY,
) {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey, JSON.stringify(state))
}

type CollapsibleSectionProps = {
  id: string
  title: string
  count: number
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
  headerActions?: ReactNode
  className?: string
}

export function CollapsibleSection({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
  headerActions,
  className,
}: CollapsibleSectionProps) {
  return (
    <section className={className} data-section-id={id}>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="text-foreground hover:bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold"
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0" />
          ) : (
            <ChevronDown className="size-4 shrink-0" />
          )}
          <span className="truncate">{title}</span>
          <span
            className={cn(
              'bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
            )}
          >
            {count}
          </span>
        </button>
        {headerActions}
      </div>
      {!collapsed ? children : null}
    </section>
  )
}
