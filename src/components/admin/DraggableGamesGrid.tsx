import { Download, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useRallyHubAdminUI } from '@/hooks/use-rallyhub-admin-ui'
import { GAME_TYPE_LABELS, gameStatusTone, type GameRow } from '@/hooks/use-games'

type DraggableGamesGridProps = {
  games: GameRow[]
  groups: { id: string; name: string }[]
  deleting: boolean
  onDelete: (game: GameRow) => void
  onAssignGroup: (gameId: string, groupId: string | null) => void
  onReorder: (gameId: string, index: number) => void
  onInstall?: (game: GameRow) => void
}

export function DraggableGamesGrid({
  games,
  groups,
  deleting,
  onDelete,
  onAssignGroup,
  onReorder,
  onInstall,
}: DraggableGamesGridProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const neoUI = useRallyHubAdminUI()

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

  return (
    <div
      className="grid auto-rows-fr gap-3 sm:grid-cols-2"
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
          className="border-border/80 bg-card flex h-full min-h-[7.5rem] flex-col gap-2 rounded-lg border p-3 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <GripVertical
              className="text-muted-foreground mt-0.5 size-4 shrink-0 cursor-grab active:cursor-grabbing"
              aria-hidden
            />
            {game.cover_url ? (
              <img
                src={game.cover_url}
                alt=""
                className="border-border/80 size-10 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="bg-muted/50 size-10 shrink-0 rounded" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-foreground line-clamp-2 text-sm font-medium leading-snug">
                {game.name}
              </p>
              <p className="text-muted-foreground text-xs">{GAME_TYPE_LABELS[game.type]}</p>
            </div>
            <StatusIndicator status={gameStatusTone(game.status)} className="shrink-0" />
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {groups.length > 0 ? (
              <select
                className="border-input bg-background max-w-[7rem] rounded border px-1.5 py-1 text-xs"
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
              neoUI ? (
                <NeoButton
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={() => onInstall(game)}
                >
                  <Download className="size-3" />
                  Install
                </NeoButton>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onInstall(game)}
                >
                  <Download className="size-3" />
                  Install
                </Button>
              )
            ) : null}
            {neoUI ? (
              <>
                <NeoButton variant="surface" size="sm" asChild>
                  <Link to={`/admin/games/${game.id}`}>
                    <Pencil className="size-3" />
                    Edit
                  </Link>
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={() => onDelete(game)}
                >
                  <Trash2 className="size-3" />
                  Delete
                </NeoButton>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link to={`/admin/games/${game.id}`}>
                    <Pencil className="size-3" />
                    Edit
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive h-7 text-xs"
                  disabled={deleting}
                  onClick={() => onDelete(game)}
                >
                  <Trash2 className="size-3" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
