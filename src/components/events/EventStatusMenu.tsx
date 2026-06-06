import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { EVENT_STATUS_LABELS } from '@/hooks/use-events'
import { getAllowedEventStatuses } from '@/lib/event-lifecycle'
import type { EventStatus } from '@/types/database'
import { cn } from '@/lib/utils'

const ALL_STATUSES: EventStatus[] = ['active', 'ready', 'draft', 'archived']

type EventStatusMenuProps = {
  status: EventStatus
  invoicedAt?: string | null
  onSelect: (status: EventStatus) => void
  disabled?: boolean
  size?: 'sm' | 'default'
}

export function EventStatusMenu({
  status,
  invoicedAt = null,
  onSelect,
  disabled,
  size = 'sm',
}: EventStatusMenuProps) {
  const [open, setOpen] = useState(false)

  const allowedStatuses = useMemo(
    () =>
      getAllowedEventStatuses({ status, invoiced_at: invoicedAt }).filter(
        (s) => s !== status,
      ),
    [status, invoicedAt],
  )

  const menuDisabled = disabled || allowedStatuses.length === 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={menuDisabled}
          className={cn('gap-1.5', size === 'sm' && 'h-8 px-2')}
        >
          <StatusIndicator status={status} />
          <span className="text-xs font-medium">{EVENT_STATUS_LABELS[status]}</span>
          {allowedStatuses.length > 0 ? (
            <ChevronDown className="size-3.5 opacity-60" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {allowedStatuses.map((s) => (
          <DropdownMenuItem
            key={s}
            className="flex items-center gap-2"
            onClick={() => {
              onSelect(s)
              setOpen(false)
            }}
          >
            <StatusIndicator status={s} />
            {EVENT_STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ALL_STATUSES as EVENT_ALL_STATUSES }
