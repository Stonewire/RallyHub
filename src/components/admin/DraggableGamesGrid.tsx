import { Download, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { GAME_TYPE_LABELS, type GameRow } from '@/hooks/use-games'

type DraggableGamesGridProps = {
  games: GameRow[]
  groups: { id: string; name: string }[]
  deleting: boolean
  onDelete: (game: GameRow) => void
  onAssignGroup: (gameId: string, groupId: string | null) => void
  onReorder: (gameId: string, index: number) => void
  onEdit: (gameId: string) => void
  onInstall?: (game: GameRow) => void
}

export function DraggableGamesGrid({
  games,
  groups,
  deleting,
  onDelete,
  onAssignGroup,
  onReorder,
  onEdit,
  onInstall,
}: DraggableGamesGridProps) {
  const [dragId, setDragId] = useState<string | null>(null)

  const sorted = [...games].sort((a, b) => {
    if (a.list_order !== b.list_order) return a.list_order - b.list_order
    return a.name.localeCompare(b.name)
  })

  function handleDrop(targetId: string | null) {
    if (!dragId) return
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
      return `${game.points_min ?? 0}–${game.points_max ?? 0} pts`
    }
    return `${game.points_static ?? 0} pts`
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
      {sorted.map((game) => (
        <article
          key={game.id}
          draggable
          onDragStart={(e) => {
            setDragId(game.id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', game.id)
          }}
          onDragEnd={() => setDragId(null)}
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
                Cover image
              </span>
            )}
            <span className="bg-nm-slate-800 absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
              {GAME_TYPE_LABELS[game.type]}
            </span>
            <GripVertical
              className="absolute left-1.5 top-1.5 size-4 cursor-grab rounded bg-black/45 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
              aria-hidden
            />
          </div>
          <div className="flex min-h-16 flex-1 flex-col items-center px-1.5 py-1.5 text-center">
            <p className="text-foreground line-clamp-2 min-h-8 text-xs font-semibold leading-4">
              {game.name}
            </p>
            <p className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {pointsLabel(game)}
            </p>
          </div>
          <div
            className="border-border/60 mt-auto flex items-center justify-center gap-1 border-t px-1.5 py-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {groups.length > 0 ? (
              <select
                aria-label={`Move ${game.name} to group`}
                className="neo-field h-7 min-w-0 flex-1 px-1.5 py-0 text-[10px]"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value
                  onAssignGroup(game.id, v === '' ? null : v === '__none' ? null : v)
                  e.target.value = ''
                }}
              >
                <option value="">Group…</option>
                <option value="__none">Ungroup</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null}
            {onInstall ? (
              <NeoButton
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                title="Install game"
                onClick={() => onInstall(game)}
              >
                <Download className="size-3" />
              </NeoButton>
            ) : null}
            <NeoButton
              type="button"
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              title="Edit game"
              onClick={() => onEdit(game.id)}
            >
              <Pencil className="size-3" />
            </NeoButton>
            <NeoButton
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive size-7 p-0"
              title="Delete game"
              disabled={deleting}
              onClick={() => onDelete(game)}
            >
              <Trash2 className="size-3" />
            </NeoButton>
          </div>
        </article>
      ))}
    </div>
  )
}
