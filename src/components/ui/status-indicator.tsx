import { cn } from '@/lib/utils'

export type RallyStatusTone = 'active' | 'draft' | 'ready' | 'archived'

const dotColors: Record<RallyStatusTone, string> = {
  active: 'bg-[var(--rh-status-dot-active)]',
  draft: 'bg-[var(--rh-status-dot-draft)]',
  ready: 'bg-[var(--rh-status-dot-ready)]',
  archived: 'bg-[var(--rh-status-dot-archived)]',
}

/** Dot + muted label — no pill backgrounds. */
export function StatusIndicator({
  status,
  label,
  className,
}: {
  status: RallyStatusTone
  label?: string
  className?: string
}) {
  const resolved =
    label ?? status.slice(0, 1).toUpperCase() + status.slice(1)

  return (
    <span
      className={cn(
        'text-muted-foreground inline-flex items-center gap-2 text-xs font-normal capitalize tracking-wide',
        className,
      )}
    >
      <span
        className={cn(
          'border-foreground/[0.08] ring-background size-1.5 shrink-0 rounded-full ring-1 ring-inset',
          dotColors[status],
        )}
        aria-hidden
      />
      {resolved}
    </span>
  )
}
