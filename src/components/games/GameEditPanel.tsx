import { X } from 'lucide-react'

import { GameEditForm } from '@/components/games/GameEditForm'
import { Button } from '@/components/ui/button'

type GameEditPanelProps = {
  gameId: string
  onClose: () => void
}

/**
 * Non-modal side panel for editing a game — the games list stays visible and
 * clickable behind it, so picking a different game just swaps the panel's
 * content instead of forcing a close-then-reopen round trip.
 */
export function GameEditPanel({ gameId, onClose }: GameEditPanelProps) {
  return (
    <div className="border-border/80 bg-background fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l shadow-2xl">
      <GameEditForm key={gameId} gameId={gameId}>
        {({ headerTitle, headerSubtitle, headerActions, body }) => (
          <>
            <div className="border-border/60 flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <h2 className="text-foreground truncate text-lg font-semibold">{headerTitle}</h2>
                {headerSubtitle ? (
                  <p className="text-muted-foreground truncate text-sm">{headerSubtitle}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerActions}
                <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{body}</div>
          </>
        )}
      </GameEditForm>
    </div>
  )
}
