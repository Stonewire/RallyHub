import { IconChevronDown } from '@/components/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  GAME_PREP_STATUS_ORDER,
  GAME_PREP_STATUS_PILL_CLASS,
} from '@/hooks/use-games'
import type { GamePrepStatus } from '@/types/database'
import { cn } from '@/lib/utils'

/** Display labels live in the translations; the stored values stay as they are. */
const PREP_STATUS_LABEL_KEY: Record<GamePrepStatus, string> = {
  draft: 'games.prepStatus.draft',
  in_progress: 'games.prepStatus.inProgress',
  done: 'games.prepStatus.done',
  needs_attention: 'games.prepStatus.needsAttention',
}

type GamePrepStatusMenuProps = {
  status: GamePrepStatus
  onSelect: (status: GamePrepStatus) => void
  disabled?: boolean
  size?: 'sm' | 'default'
}

/**
 * Prep-status pill that doubles as a dropdown to change it, mirroring
 * EventStatusMenu. Unlike event status there are no lifecycle constraints, so
 * every other status is always selectable.
 */
export function GamePrepStatusMenu({
  status,
  onSelect,
  disabled,
  size = 'sm',
}: GamePrepStatusMenuProps) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const others = GAME_PREP_STATUS_ORDER.filter((s) => s !== status)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={disabled}
          className={cn(
            'gap-1.5 rounded-full',
            GAME_PREP_STATUS_PILL_CLASS[status],
            size === 'sm' && 'h-8 px-3',
          )}
        >
          <span className="text-xs font-semibold">{t(PREP_STATUS_LABEL_KEY[status])}</span>
          <IconChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        {others.map((s) => (
          <DropdownMenuItem
            key={s}
            className="flex items-center gap-2"
            onClick={() => {
              onSelect(s)
              setOpen(false)
            }}
          >
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                GAME_PREP_STATUS_PILL_CLASS[s],
              )}
            >
              {t(PREP_STATUS_LABEL_KEY[s])}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
