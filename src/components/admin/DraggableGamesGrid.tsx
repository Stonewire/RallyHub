import { IconCopy, IconDownload, IconGrip, IconTrash } from '@/components/icons'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createPortal } from 'react-dom'

import { gameTypeTagClass } from '@/lib/game-type-styles'
import { NeoButton } from '@/components/neo-minimal'
import { GAME_PREP_STATUS_ORDER, GAME_TYPE_LABEL_KEYS, type GameRow } from '@/hooks/use-games'
import { GamePrepStatusMenu } from '@/components/games/GamePrepStatusMenu'
import type { GamePrepStatus } from '@/types/database'

type DraggableGamesGridProps = {
  games: GameRow[]
  /** Group names per game id, for the card footer. */
  groupNamesByGame: Record<string, string[]>
  deleting: boolean
  onDelete: (game: GameRow) => void
  /** Absent on the platform library, where copying into place makes no sense. */
  onDuplicate?: (game: GameRow) => void
  onReorder: (gameId: string, index: number) => void
  onEdit: (gameId: string) => void
  onInstall?: (game: GameRow) => void
  /** 'status' sorts by prep status and disables drag (manual order is list_order). */
  sortMode?: 'manual' | 'status'
  onPrepStatusChange?: (gameId: string, status: GamePrepStatus) => void
  prepStatusPending?: boolean
  /** Hidden on the platform template library, where prep tracking is meaningless. */
  showPrepStatus?: boolean
}

export function DraggableGamesGrid({
  games,
  groupNamesByGame,
  deleting,
  onDelete,
  onDuplicate,
  onReorder,
  onEdit,
  onInstall,
  sortMode = 'manual',
  onPrepStatusChange,
  prepStatusPending,
  showPrepStatus = false,
}: DraggableGamesGridProps) {
  const { t } = useTranslation('admin')
  const [dragId, setDragId] = useState<string | null>(null)
  // Hovering anywhere on a card reveals its full group list after a beat. Held
  // at grid level so there is one floating label rather than one per card.
  const [groupTip, setGroupTip] = useState<{ label: string; x: number; y: number } | null>(null)
  const tipTimer = useRef<number | null>(null)

  function showGroupTip(element: HTMLElement, label: string) {
    if (tipTimer.current) window.clearTimeout(tipTimer.current)
    if (!label.trim()) return
    tipTimer.current = window.setTimeout(() => {
      const rect = element.getBoundingClientRect()
      setGroupTip({ label, x: rect.left + rect.width / 2, y: rect.top })
    }, 450)
  }

  function hideGroupTip() {
    if (tipTimer.current) window.clearTimeout(tipTimer.current)
    tipTimer.current = null
    setGroupTip(null)
  }


  const dragEnabled = sortMode === 'manual'

  const sorted = [...games].sort((a, b) => {
    if (sortMode === 'status') {
      const ra = GAME_PREP_STATUS_ORDER.indexOf((a.prep_status ?? 'draft') as GamePrepStatus)
      const rb = GAME_PREP_STATUS_ORDER.indexOf((b.prep_status ?? 'draft') as GamePrepStatus)
      if (ra !== rb) return ra - rb
    }
    if (a.list_order !== b.list_order) return a.list_order - b.list_order
    return a.name.localeCompare(b.name)
  })

  function handleDrop(targetId: string | null) {
    if (!dragEnabled || !dragId) return
    const without = sorted.filter((g) => g.id !== dragId)
    let index = without.length
    if (targetId) {
      const idx = without.findIndex((g) => g.id === targetId)
      if (idx >= 0) index = idx
    }
    onReorder(dragId, index)
    setDragId(null)
  }

  function pointsLabel(game: GameRow) {
    if (game.points_type === 'range') {
      return t('games.grid.pointsRange', {
        min: game.points_min ?? 0,
        max: game.points_max ?? 0,
      })
    }
    return t('games.grid.pointsStatic', { points: game.points_static ?? 0 })
  }

  return (
    <div
      className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        handleDrop(null)
      }}
    >
      {sorted.map((game) => {
        const gameGroupNames = groupNamesByGame[game.id] ?? []
        return (
        <article
          key={game.id}
          draggable={dragEnabled}
          onDragStart={(e) => {
            setDragId(game.id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', game.id)
          }}
          onDragEnd={() => setDragId(null)}
          onMouseEnter={(e) => showGroupTip(e.currentTarget, gameGroupNames.join(', '))}
          onMouseLeave={hideGroupTip}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleDrop(game.id)
          }}
          className="border-border/80 bg-card group relative flex h-full min-h-36 cursor-pointer flex-col overflow-hidden rounded-lg border shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-nm-slate-400 hover:shadow-md"
          onClick={() => onEdit(game.id)}
        >
          <div className="bg-nm-slate-100 relative flex h-[50px] items-center justify-center overflow-hidden">
            {game.cover_url ? (
              <img
                src={game.cover_url}
                alt=""
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <span className="text-nm-slate-500 text-[9px] font-semibold uppercase tracking-[0.12em]">
                {t('games.grid.coverImage')}
              </span>
            )}
            <span className={`absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white ${gameTypeTagClass(game.type)}`}>
              {t(GAME_TYPE_LABEL_KEYS[game.type])}
            </span>
            {/* Delete sits over the cover so the card footer is free for the
                group list. Appears on hover, like the drag handle. */}
            <button
              type="button"
              title={t('games.grid.deleteGame')}
              aria-label={t('games.grid.deleteNamed', { name: game.name })}
              disabled={deleting}
              className="absolute left-1.5 top-1.5 rounded bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70 disabled:opacity-30"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(game)
              }}
            >
              <IconTrash className="size-3.5" />
            </button>
            {/* Beside Delete, same hover treatment. Building a variant of an
                existing game was otherwise a full rebuild by hand. */}
            {onDuplicate ? (
              <button
                type="button"
                title={t('games.grid.duplicateGame')}
                aria-label={t('games.grid.duplicateNamed', { name: game.name })}
                className="absolute left-9 top-1.5 rounded bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
                onClick={(event) => {
                  event.stopPropagation()
                  onDuplicate(game)
                }}
              >
                <IconCopy className="size-3.5" />
              </button>
            ) : null}
            {dragEnabled ? (
              <IconGrip
                className="absolute bottom-1.5 left-1.5 size-4 cursor-grab rounded bg-black/45 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                aria-hidden
              />
            ) : null}
          </div>
          <div className="flex min-h-16 flex-1 flex-col items-center px-1.5 py-1.5 text-center">
            <p className="text-foreground line-clamp-2 min-h-8 text-xs font-semibold leading-4">
              {game.name}
            </p>
            <p className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {pointsLabel(game)}
            </p>
            {showPrepStatus && onPrepStatusChange ? (
              // Clicking the pill must not open the editor (the whole card is a
              // click target), so swallow the click before it bubbles.
              <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                <GamePrepStatusMenu
                  status={(game.prep_status ?? 'draft') as GamePrepStatus}
                  disabled={prepStatusPending}
                  onSelect={(status) => onPrepStatusChange(game.id, status)}
                />
              </div>
            ) : null}
          </div>
          {/* Groups this game belongs to, as plain text. No edit button: the
              card itself opens the editor, so a pencil would be a second
              control for the same action. Truncated with the full list on
              hover, since a game can sit in several groups. */}
          <div className="border-border/60 mt-auto flex items-center gap-1 border-t px-1.5 py-1.5">
            <p className="text-muted-foreground min-w-0 flex-1 truncate text-[10px]">
              {gameGroupNames.length > 0 ? gameGroupNames.join(', ') : t('games.grid.noGroup')}
            </p>
            {onInstall ? (
              <NeoButton
                type="button"
                variant="ghost"
                size="sm"
                className="size-6 shrink-0 p-0"
                title={t('games.grid.installGame')}
                onClick={(event) => {
                  event.stopPropagation()
                  onInstall(game)
                }}
              >
                <IconDownload className="size-3.5" />
              </NeoButton>
            ) : null}
          </div>
        </article>
        )
      })}
      {groupTip
        ? createPortal(
            <span
              role="tooltip"
              className="bg-nm-slate-900 pointer-events-none fixed z-[100] max-w-64 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-[11px] leading-snug text-white shadow-lg"
              style={{ left: groupTip.x, top: groupTip.y - 6 }}
            >
              {groupTip.label}
            </span>,
            document.body,
          )
        : null}
    </div>
  )
}
