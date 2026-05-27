import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImageIcon,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { CompactListRow } from '@/components/admin/CompactListRow'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusIndicator } from '@/components/ui/status-indicator'
import {
  useAssignGameToGroup,
  useDeleteGameGroup,
  useGameGroups,
  useRenameGameGroup,
} from '@/hooks/use-game-groups'
import {
  GAME_TYPE_LABELS,
  gameStatusTone,
  useCreateGameGroup,
  useDeleteGame,
  useGames,
  type GameRow,
} from '@/hooks/use-games'
import { useOrganizationId } from '@/hooks/use-organization-id'
import type { GameType } from '@/types/database'

const FILTERS: { value: 'all' | GameType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'music_bingo', label: 'Music Bingo' },
]

function GameRow({
  game,
  groups,
  onDelete,
  onAssignGroup,
  deleting,
}: {
  game: GameRow
  groups: { id: string; name: string }[]
  onDelete: () => void
  onAssignGroup: (groupId: string | null) => void
  deleting: boolean
}) {
  return (
    <CompactListRow
      actions={
        <>
          {groups.length > 0 ? (
            <select
              className="border-input bg-background max-w-[7rem] rounded border px-1.5 py-1 text-xs"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value
                onAssignGroup(v === '' ? null : v === '__none' ? null : v)
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
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to={`/admin/games/${game.id}`}>
              <Pencil className="size-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            disabled={deleting}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-2.5">
        <GripVertical
          className="text-muted-foreground size-4 shrink-0 cursor-grab"
          aria-hidden
        />
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt=""
            className="border-border/80 size-8 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="bg-muted/50 size-8 shrink-0 rounded" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{game.name}</p>
          <p className="text-muted-foreground text-xs">{GAME_TYPE_LABELS[game.type]}</p>
        </div>
        <StatusIndicator status={gameStatusTone(game.status)} className="shrink-0" />
      </div>
    </CompactListRow>
  )
}

function GroupHeader({
  name,
  count,
  collapsed,
  onToggle,
  editing,
  editName,
  onEditNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
}: {
  name: string
  count: number
  collapsed: boolean
  onToggle: () => void
  editing: boolean
  editName: string
  onEditNameChange: (v: string) => void
  onStartRename: () => void
  onSaveRename: () => void
  onCancelRename: () => void
  onDelete: () => void
}) {
  return (
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
        {editing ? (
          <Input
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRename()
              if (e.key === 'Escape') onCancelRename()
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background h-8 max-w-xs text-sm"
            autoFocus
          />
        ) : (
          <span className="truncate">{name}</span>
        )}
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {count}
        </span>
      </button>
      {editing ? (
        <>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onSaveRename}>
            <Check className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onCancelRename}>
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onStartRename}>
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  )
}

export function AdminGamesPage() {
  const organizationId = useOrganizationId()
  const gamesQuery = useGames(organizationId)
  const groupsQuery = useGameGroups(organizationId)
  const deleteGame = useDeleteGame(organizationId)
  const createGroup = useCreateGameGroup(organizationId)
  const assignGroup = useAssignGameToGroup(organizationId)
  const renameGroup = useRenameGameGroup(organizationId)
  const deleteGroup = useDeleteGameGroup(organizationId)

  const [filter, setFilter] = useState<'all' | GameType>('all')
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')

  const groups = groupsQuery.data ?? []
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }))

  const gameToGroupId = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groups) {
      for (const item of g.items) {
        map.set(item.game_id, g.id)
      }
    }
    return map
  }, [groups])

  const filtered = useMemo(() => {
    const list = gamesQuery.data ?? []
    return list.filter((game) => {
      const matchesType = filter === 'all' || game.type === filter
      const q = search.trim().toLowerCase()
      const matchesSearch = !q || game.name.toLowerCase().includes(q)
      return matchesType && matchesSearch
    })
  }, [gamesQuery.data, filter, search])

  const ungrouped = filtered.filter((g) => !gameToGroupId.has(g.id))

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteGame.mutateAsync(id)
  }

  async function handleNewGroup() {
    const name = window.prompt('Group name')
    if (!name?.trim()) return
    await createGroup.mutateAsync(name.trim())
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((c) => ({ ...c, [id]: !c[id] }))
  }

  function startRename(groupId: string, currentName: string) {
    setEditingGroupId(groupId)
    setEditGroupName(currentName)
  }

  async function saveRename(groupId: string) {
    const name = editGroupName.trim()
    if (!name) return
    await renameGroup.mutateAsync({ groupId, name })
    setEditingGroupId(null)
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (
      !window.confirm(
        `Delete group "${groupName}"? Games in this group will move to Ungrouped.`,
      )
    ) {
      return
    }
    await deleteGroup.mutateAsync(groupId)
    if (editingGroupId === groupId) setEditingGroupId(null)
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Games" subtitle="List and manage game templates.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const isLoading = gamesQuery.isLoading || groupsQuery.isLoading

  const listShell = (children: ReactNode) => (
    <div className="border-border/80 overflow-hidden rounded-lg border bg-card shadow-sm">
      {children}
    </div>
  )

  return (
    <AdminPageShell
      title="Games"
      subtitle="List and manage game templates and configurations."
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => void handleNewGroup()}>
            New Group
          </Button>
          <AccentButton asChild>
            <Link to="/admin/games/new">Create New Game</Link>
          </AccentButton>
        </>
      }
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={filter === value ? 'secondary' : 'outline'}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games…"
            className="bg-card pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <QueryLoading rows={6} />
      ) : gamesQuery.isError ? (
        <QueryError message={gamesQuery.error.message} />
      ) : filtered.length === 0 && groups.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
          <ImageIcon className="text-muted-foreground size-10 opacity-60" />
          <p className="text-foreground font-medium">No games yet</p>
          <AccentButton asChild className="mt-2">
            <Link to="/admin/games/new">Create New Game</Link>
          </AccentButton>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupGames = filtered.filter(
              (g) => gameToGroupId.get(g.id) === group.id,
            )
            const collapsed = collapsedGroups[group.id]
            return (
              <section key={group.id}>
                <GroupHeader
                  name={group.name}
                  count={groupGames.length}
                  collapsed={Boolean(collapsed)}
                  onToggle={() => toggleGroup(group.id)}
                  editing={editingGroupId === group.id}
                  editName={editGroupName}
                  onEditNameChange={setEditGroupName}
                  onStartRename={() => startRename(group.id, group.name)}
                  onSaveRename={() => void saveRename(group.id)}
                  onCancelRename={() => setEditingGroupId(null)}
                  onDelete={() => void handleDeleteGroup(group.id, group.name)}
                />
                {!collapsed ? (
                  groupGames.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No games in this group.</p>
                  ) : (
                    listShell(
                      groupGames.map((game) => (
                        <GameRow
                          key={game.id}
                          game={game}
                          groups={groupOptions}
                          deleting={deleteGame.isPending}
                          onDelete={() => void handleDelete(game.id, game.name)}
                          onAssignGroup={(gid) =>
                            void assignGroup.mutateAsync({
                              gameId: game.id,
                              groupId: gid,
                            })
                          }
                        />
                      )),
                    )
                  )
                ) : null}
              </section>
            )
          })}

          {ungrouped.length > 0 ? (
            <section>
              <h2 className="text-foreground mb-2 text-sm font-semibold">
                Ungrouped
                <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                  {ungrouped.length}
                </span>
              </h2>
              {listShell(
                ungrouped.map((game) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    groups={groupOptions}
                    deleting={deleteGame.isPending}
                    onDelete={() => void handleDelete(game.id, game.name)}
                    onAssignGroup={(gid) =>
                      void assignGroup.mutateAsync({ gameId: game.id, groupId: gid })
                    }
                  />
                )),
              )}
            </section>
          ) : null}
        </div>
      )}
    </AdminPageShell>
  )
}
