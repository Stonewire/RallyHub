import {
  Check,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { DraggableGamesGrid } from '@/components/admin/DraggableGamesGrid'
import { InstallGameModal } from '@/components/rallyhub/InstallGameModal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  useAssignGameToGroup,
  useDeleteGameGroup,
  useGameGroups,
  useRenameGameGroup,
} from '@/hooks/use-game-groups'
import {
  useAdminGames,
  useCreateGameGroup,
  useDeleteGame,
  useReorderGames,
  type GameRow,
} from '@/hooks/use-games'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import type { GameType } from '@/types/database'

const FILTERS: { value: 'all' | GameType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'music_bingo', label: 'Music Bingo' },
]

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
  neoUI,
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
  neoUI?: boolean
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
        neoUI ? (
          <>
            <NeoButton type="button" variant="ghost" size="sm" className="size-8 p-0" onClick={onSaveRename}>
              <Check className="size-4" />
            </NeoButton>
            <NeoButton type="button" variant="ghost" size="sm" className="size-8 p-0" onClick={onCancelRename}>
              <X className="size-4" />
            </NeoButton>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onSaveRename}>
              <Check className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onCancelRename}>
              <X className="size-4" />
            </Button>
          </>
        )
      ) : neoUI ? (
        <>
          <NeoButton type="button" variant="ghost" size="sm" onClick={onStartRename}>
            Rename
          </NeoButton>
          <NeoButton
            type="button"
            variant="destructive"
            size="sm"
            className="size-8 p-0"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </NeoButton>
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
  const isPlatformLibrary = useIsPlatformGamesAdmin()
  const organizationId = useAdminOrganizationId()
  const orgLoading = useAdminOrganizationLoading()
  const gamesQuery = useAdminGames(organizationId, isPlatformLibrary)
  const groupsQuery = useGameGroups(organizationId)
  const deleteGame = useDeleteGame(organizationId)
  const createGroup = useCreateGameGroup(organizationId)
  const assignGroup = useAssignGameToGroup(organizationId)
  const renameGroup = useRenameGameGroup(organizationId)
  const deleteGroup = useDeleteGameGroup(organizationId)
  const reorderGames = useReorderGames(organizationId)

  const [filter, setFilter] = useState<'all' | GameType>('all')
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [installGame, setInstallGame] = useState<GameRow | null>(null)

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

  if (orgLoading) {
    return (
      <AdminPageShell
        title="Games"
        subtitle={
          isPlatformLibrary
            ? 'Platform game templates for all clients.'
            : 'List and manage game templates.'
        }
      >
        <QueryLoading rows={6} />
      </AdminPageShell>
    )
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Games" subtitle="List and manage game templates.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const isLoading = gamesQuery.isLoading || groupsQuery.isLoading

  function handleReorder(gameId: string, index: number) {
    const list = [...(gamesQuery.data ?? [])].sort((a, b) => {
      if (a.list_order !== b.list_order) return a.list_order - b.list_order
      return a.name.localeCompare(b.name)
    })
    const without = list.filter((g) => g.id !== gameId)
    const next = [...without.slice(0, index), list.find((g) => g.id === gameId)!, ...without.slice(index)]
      .filter(Boolean)
      .map((g) => g.id)
    void reorderGames.mutateAsync(next)
  }

  return (
    <AdminPageShell
      title="Games"
      subtitle={
        isPlatformLibrary
          ? 'Platform game templates for all clients.'
          : 'List and manage game templates and configurations.'
      }
      actions={
        isPlatformLibrary ? (
          <>
            <NeoButton type="button" variant="surface" onClick={() => void handleNewGroup()}>
              New Group
            </NeoButton>
            <NeoButton variant="accent" asChild>
              <Link to="/admin/games/new">Create New Game</Link>
            </NeoButton>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => void handleNewGroup()}>
              New Group
            </Button>
            <AccentButton asChild>
              <Link to="/admin/games/new">Create New Game</Link>
            </AccentButton>
          </>
        )
      }
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ value, label }) =>
            isPlatformLibrary ? (
              <NeoButton
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? 'primary' : 'surface'}
                onClick={() => setFilter(value)}
              >
                {label}
              </NeoButton>
            ) : (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? 'secondary' : 'outline'}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ),
          )}
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
          {isPlatformLibrary ? (
            <NeoButton variant="accent" asChild className="mt-2">
              <Link to="/admin/games/new">Create New Game</Link>
            </NeoButton>
          ) : (
            <AccentButton asChild className="mt-2">
              <Link to="/admin/games/new">Create New Game</Link>
            </AccentButton>
          )}
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
                  neoUI={isPlatformLibrary}
                />
                {!collapsed ? (
                  groupGames.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No games in this group.</p>
                  ) : (
                    <DraggableGamesGrid
                      games={groupGames}
                      groups={groupOptions}
                      deleting={deleteGame.isPending}
                      onDelete={(game) => void handleDelete(game.id, game.name)}
                      onAssignGroup={(gameId, gid) =>
                        void assignGroup.mutateAsync({ gameId, groupId: gid })
                      }
                      onReorder={handleReorder}
                      onInstall={
                        isPlatformLibrary ? (game) => setInstallGame(game) : undefined
                      }
                    />
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
              <DraggableGamesGrid
                games={ungrouped}
                groups={groupOptions}
                deleting={deleteGame.isPending}
                onDelete={(game) => void handleDelete(game.id, game.name)}
                onAssignGroup={(gameId, gid) =>
                  void assignGroup.mutateAsync({ gameId, groupId: gid })
                }
                onReorder={handleReorder}
                onInstall={isPlatformLibrary ? (game) => setInstallGame(game) : undefined}
              />
            </section>
          ) : null}
        </div>
      )}
      {installGame ? (
        <InstallGameModal game={installGame} onClose={() => setInstallGame(null)} />
      ) : null}
    </AdminPageShell>
  )
}
