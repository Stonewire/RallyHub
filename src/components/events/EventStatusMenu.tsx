import { IconAlert, IconChevronDown } from '@/components/icons'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EVENT_STATUS_LABEL_KEYS, EVENT_STATUS_PILL_CLASS } from '@/hooks/use-events'
import { getAllowedEventStatuses } from '@/lib/event-lifecycle'
import type { EventStatus } from '@/types/database'
import { cn } from '@/lib/utils'

const ALL_STATUSES: EventStatus[] = ['active', 'demo', 'ready', 'draft', 'archived']

type EventStatusMenuProps = {
  status: EventStatus
  /** Set once the event has actually gone live — after which it can only be archived. */
  activatedAt?: string | null
  onSelect: (status: EventStatus) => void
  disabled?: boolean
  size?: 'sm' | 'default'
}

export function EventStatusMenu({
  status,
  activatedAt = null,
  onSelect,
  disabled,
  size = 'sm',
}: EventStatusMenuProps) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)

  const allowedStatuses = useMemo(
    () =>
      getAllowedEventStatuses({ status, activated_at: activatedAt }).filter(
        (s) => s !== status,
      ),
    [status, activatedAt],
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
          data-tour="event-status-menu"
          className={cn(
            'gap-1.5 rounded-full',
            EVENT_STATUS_PILL_CLASS[status],
            size === 'sm' && 'h-8 px-3',
          )}
        >
          {/* Solid coloured pill carries the status, so no dot and no second
              label. Both used to render, which read as "Ready Ready". */}
          <span className="text-xs font-semibold">{t(EVENT_STATUS_LABEL_KEYS[status])}</span>
          {allowedStatuses.length > 0 ? (
            <IconChevronDown className="size-3.5 opacity-60" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem] max-w-[17rem]">
        {allowedStatuses.map((s) => (
          <DropdownMenuItem
            key={s}
            className="flex flex-col items-start gap-1.5 py-1.5"
            onClick={() => {
              onSelect(s)
              setOpen(false)
            }}
          >
            {/* Same pill as the trigger, so the menu shows the colour you are
                choosing rather than a dot next to plain text. */}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                EVENT_STATUS_PILL_CLASS[s],
              )}
            >
              {t(EVENT_STATUS_LABEL_KEYS[s])}
            </span>
            {/* The two consequential choices explain themselves in the menu:
                Demo is the safe way to test, Active charges and starts the
                24 hour live window. */}
            {s === 'demo' ? (
              <span className="text-muted-foreground text-xs leading-relaxed">
                {t('events.status.demoHint')}
              </span>
            ) : null}
            {s === 'active' ? (
              <span className="text-foreground flex items-start gap-1.5 text-xs leading-relaxed">
                <IconAlert className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{t('events.status.activeWarning')}</span>
              </span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ALL_STATUSES as EVENT_ALL_STATUSES }
