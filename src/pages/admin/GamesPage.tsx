import { IconCheck, IconChevronDown, IconChevronRight, IconClose, IconPhoto, IconSearch, IconTrash } from '@/components/icons'
import { useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { orgPath } from '@/lib/org-path'
import { useOptionalTenant } from '@/contexts/tenant-context'

import { BinPanel } from '@/components/admin/BinPanel'
import { DraggableGamesGrid } from '@/components/admin/DraggableGamesGrid'
import { GameEditPanel } from '@/components/games/GameEditPanel'
import { GameImportModal } from '@/components/games/GameImportModal'
import { NewGameTypeModal } from '@/components/games/NewGameTypeModal'
import { InstallGameGroupModal } from '@/components/rallyhub/InstallGameGroupModal'
import { InstallGameModal } from '@/components/rallyhub/InstallGameModal'
import { InstallMusicLibraryModal } from '@/components/rallyhub/InstallMusicLibraryModal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import {
  MusicCatalogManager,
  type MusicCatalogHandle,
} from '@/components/games/MusicCatalogManager'
import {
  InventoryLibraryManager,
  type InventoryLibraryHandle,
} from '@/components/games/InventoryLibraryManager'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useAddGamesToGroup,
  useDeleteGameGroup,
  useGameGroups,
  useRenameGameGroup,
  type GameGroupWithItems,
} from '@/hooks/use-game-groups'
import {
  useAdminGames,
  useCreateGameGroup,
  useDeleteGame,
  useDuplicateGame,
  useReorderGames,
  useUpdateGamePrepStatus,
  usePermanentlyDeleteGame,
  useRestoreGame,
  useTrashedGames,
  type GameRow,
} from '@/hooks/use-games'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import type { GameType } from '@/types/database'

const FILTERS: { value: 'all' | GameType; labelKey: string }[] = [
  { value: 'all', labelKey: 'games.types.all' },
  { value: 'photo', labelKey: 'games.types.photo' },
  { value: 'video', labelKey: 'games.types.video' },
  { value: 'text', labelKey: 'games.types.text' },
  { value: 'quiz', labelKey: 'games.types.quiz' },
  { value: 'music_bingo', labelKey: 'games.types.musicBingo' },
  { value: 'puzzle', labelKey: 'games.types.puzzle' },
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
  onInstall,
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
  onInstall?: () => void
}) {
  const { t } = useTranslation('admin')
  return (
    <div className="border-border/70 mb-3 flex items-center gap-2 border-b pb-2">
      <button
        type="button"
        className="text-foreground hover:bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-[0.08em]"
        onClick={onToggle}
      >
        {collapsed ? (
          <IconChevronRight className="size-4 shrink-0" />
        ) : (
          <IconChevronDown className="size-4 shrink-0" />
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
          {/* Icon-only, so the label has to be spoken. Naming the group as well
              as the action matters here: the page repeats this row once per
              group, and "Delete" eight times in a row says nothing about which
              one is about to go. */}
          <NeoButton
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label={t('games.groups.saveNameAria', { name })}
            title={t('common:save')}
            onClick={onSaveRename}
          >
            <IconCheck className="size-4" />
          </NeoButton>
          <NeoButton
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            aria-label={t('games.groups.cancelRenameAria', { name })}
            title={t('common:cancel')}
            onClick={onCancelRename}
          >
            <IconClose className="size-4" />
          </NeoButton>
        </>
      ) : (
        <>
          {onInstall ? (
            <NeoButton type="button" variant="surface" size="sm" onClick={onInstall}>
              {t('games.groups.installGroup')}
            </NeoButton>
          ) : null}
          <NeoButton type="button" variant="ghost" size="sm" onClick={onStartRename}>
            {t('games.groups.rename')}
          </NeoButton>
          <NeoButton
            type="button"
            variant="destructive"
            size="sm"
            className="size-8 p-0"
            aria-label={t('games.groups.deleteGroupAria', { name })}
            title={t('games.groups.deleteGroupAria', { name })}
            onClick={onDelete}
          >
            <IconTrash className="size-4" />
          </NeoButton>
        </>
      )}
    </div>
  )
}

export function AdminGamesPage() {
  const { t } = useTranslation('admin')
  const isPlatformLibrary = useIsPlatformGamesAdmin()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  const organizationId = useAdminOrganizationId()
  const orgLoading = useAdminOrganizationLoading()
  const gamesQuery = useAdminGames(organizationId, isPlatformLibrary)
  const groupsQuery = useGameGroups(organizationId)
  const deleteGame = useDeleteGame(organizationId)
  const createGroup = useCreateGameGroup(organizationId)
  const addGamesToGroup = useAddGamesToGroup(organizationId)
  const duplicateGame = useDuplicateGame(organizationId)
  const renameGroup = useRenameGameGroup(organizationId)
  const deleteGroup = useDeleteGameGroup(organizationId)
  const reorderGames = useReorderGames(organizationId)
  const updatePrepStatus = useUpdateGamePrepStatus(organizationId)
  const trashedGamesQuery = useTrashedGames(organizationId, isPlatformLibrary)
  const restoreGame = useRestoreGame(organizationId)
  const permanentlyDeleteGame = usePermanentlyDeleteGame(organizationId)
  // The RPC refuses games that still carry submissions or event links, so its
  // message is shown rather than swallowed: "nothing happened" would be worse.
  const [purgeError, setPurgeError] = useState<string | null>(null)

  async function handleDuplicateGame(game: GameRow) {
    setDialogError(null)
    try {
      await duplicateGame.mutateAsync(game)
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : t('games.errors.duplicateFailed'))
    }
  }
  const navigate = useNavigate()

  const [view, setView] = useState<'games' | 'catalog' | 'inventory' | 'bin'>('games')
  const [sortMode, setSortMode] = useState<'manual' | 'status'>('manual')
  const [filter, setFilter] = useState<'all' | GameType>('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  /** Touch widths get the full-screen editor; the slide-over stays desktop. */
  function openGameEditor(id: string) {
    if (window.matchMedia('(max-width: 1279px)').matches) navigate(orgPath(clientSlug, `/admin/games/${id}`))
    else setEditingGameId(id)
  }
  const musicRef = useRef<MusicCatalogHandle>(null)
  const inventoryRef = useRef<InventoryLibraryHandle>(null)
  // Bin selection lives here so the page header can act on it, the same way
  // every other tab's primary actions sit in the header.
  const [binSelected, setBinSelected] = useState<Set<string>>(new Set())
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [installGame, setInstallGame] = useState<GameRow | null>(null)
  const [installMusicOpen, setInstallMusicOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [installGroup, setInstallGroup] = useState<{
    name: string
    games: GameRow[]
  } | null>(null)
  const [pendingDeleteGame, setPendingDeleteGame] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [newGameOpen, setNewGameOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [createGroupSelection, setCreateGroupSelection] = useState<Set<string>>(new Set())
  const [createGroupType, setCreateGroupType] = useState<'all' | GameType>('all')
  // Design's source-group selector: build a new group by drawing from an
  // existing one, rather than hunting the whole library each time.
  const [createGroupSource, setCreateGroupSource] = useState('all')
  const [createGroupSearch, setCreateGroupSearch] = useState('')
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [addToGroupSelection, setAddToGroupSelection] = useState<Set<string>>(new Set())
  const [addToGroupType, setAddToGroupType] = useState<'all' | GameType>('all')
  const [addToGroupSearch, setAddToGroupSearch] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  /** Display label for a game type; unknown types fall back to the raw value. */
  function gameTypeLabel(type: string): string {
    const entry = FILTERS.find((item) => item.value === type)
    return entry ? t(entry.labelKey) : type
  }

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const allGames = useMemo(() => gamesQuery.data ?? [], [gamesQuery.data])

  const groupNamesByGame = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const group of groups) {
      for (const item of group.items) {
        if (!map[item.game_id]) map[item.game_id] = []
        map[item.game_id].push(group.name)
      }
    }
    return map
  }, [groups])

  /**
   * Every group a game belongs to, not just one.
   *
   * This used to be a game -> single group id map, so a game in two groups was
   * only ever drawn under whichever group the loop saw last and vanished from
   * the other. Membership has always been many-to-many in the schema.
   */
  const gameToGroupIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const g of groups) {
      for (const item of g.items) {
        const set = map.get(item.game_id) ?? new Set<string>()
        set.add(g.id)
        map.set(item.game_id, set)
      }
    }
    return map
  }, [groups])

  // Only meaningful when a single group is selected; that is the one place the
  // "add games to this group" action is offered.
  const activeGroup = groups.find((group) => group.id === groupFilter) ?? null
  const addToGroupCandidates = useMemo(() => {
    const q = addToGroupSearch.trim().toLowerCase()
    // Hide only what is already in THIS group. Membership is many-to-many, so a
    // game sitting in another group is still a fair candidate; the old check
    // read gameToGroupId, which keeps one group per game and so hid games that
    // belonged elsewhere.
    const alreadyIn = new Set(activeGroup?.items.map((item) => item.game_id) ?? [])
    return allGames.filter((game) => {
      if (alreadyIn.has(game.id)) return false
      if (addToGroupType !== 'all' && game.type !== addToGroupType) return false
      return !q || game.name.toLowerCase().includes(q)
    })
  }, [allGames, activeGroup, addToGroupType, addToGroupSearch])

  const filtered = useMemo(() => {
    const list = gamesQuery.data ?? []
    return list.filter((game) => {
      const matchesType = filter === 'all' || game.type === filter
      const matchesGroup =
        groupFilter === 'all' || Boolean(gameToGroupIds.get(game.id)?.has(groupFilter))
      const q = search.trim().toLowerCase()
      const matchesSearch = !q || game.name.toLowerCase().includes(q)
      return matchesType && matchesGroup && matchesSearch
    })
  }, [gamesQuery.data, filter, groupFilter, search, gameToGroupIds])
  const filteredTrashed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (trashedGamesQuery.data ?? []).filter((game) => {
      const matchesType = filter === 'all' || game.type === filter
      const matchesGroup = groupFilter === 'all' || Boolean(gameToGroupIds.get(game.id)?.has(groupFilter))
      return matchesType && matchesGroup && (!q || game.name.toLowerCase().includes(q))
    })
  }, [trashedGamesQuery.data, filter, groupFilter, search, gameToGroupIds])

  const ungrouped = filtered.filter((g) => !gameToGroupIds.has(g.id))
  const createGroupCandidates = useMemo(() => {
    const q = createGroupSearch.trim().toLowerCase()
    const sourceIds =
      createGroupSource === 'all'
        ? null
        : new Set(
            groups
              .find((group) => group.id === createGroupSource)
              ?.items.map((item) => item.game_id) ?? [],
          )
    return allGames.filter((game) => {
      if (sourceIds && !sourceIds.has(game.id)) return false
      if (createGroupType !== 'all' && game.type !== createGroupType) return false
      return !q || game.name.toLowerCase().includes(q)
    })
  }, [allGames, createGroupSearch, createGroupType, createGroupSource, groups])

  function gamesForGroup(group: GameGroupWithItems): GameRow[] {
    const byId = new Map(allGames.map((g) => [g.id, g]))
    return group.items
      .map((item) => byId.get(item.game_id))
      .filter((game): game is GameRow => Boolean(game))
  }

  function openInstallGroup(group: GameGroupWithItems) {
    setInstallGroup({
      name: group.name,
      games: gamesForGroup(group),
    })
  }

  function openCreateGroupDialog() {
    setDialogError(null)
    setNewGroupName('')
    setCreateGroupSelection(new Set())
    setCreateGroupType('all')
    setCreateGroupSearch('')
    setCreateGroupOpen(true)
  }

  async function confirmCreateGroup() {
    const name = newGroupName.trim()
    if (!name) {
      setDialogError(t('games.errors.enterGroupName'))
      return
    }
    setDialogError(null)
    try {
      const group = await createGroup.mutateAsync(name)
      await addGamesToGroup.mutateAsync({
        gameIds: [...createGroupSelection],
        groupId: group.id,
      })
      setCreateGroupOpen(false)
      setNewGroupName('')
      setCreateGroupSelection(new Set())
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : t('games.errors.createGroupFailed'))
    }
  }

  function toggleCreateGroupGame(gameId: string) {
    setCreateGroupSelection((current) => {
      const next = new Set(current)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  function toggleAllCreateGroupGames() {
    setCreateGroupSelection((current) => {
      const allVisibleSelected =
        createGroupCandidates.length > 0 &&
        createGroupCandidates.every((game) => current.has(game.id))
      const next = new Set(current)
      for (const game of createGroupCandidates) {
        if (allVisibleSelected) next.delete(game.id)
        else next.add(game.id)
      }
      return next
    })
  }

  function openAddToGroupDialog() {
    setDialogError(null)
    setAddToGroupSelection(new Set())
    setAddToGroupType('all')
    setAddToGroupSearch('')
    setAddToGroupOpen(true)
  }

  function toggleAddToGroupGame(gameId: string) {
    setAddToGroupSelection((current) => {
      const next = new Set(current)
      if (next.has(gameId)) next.delete(gameId)
      else next.add(gameId)
      return next
    })
  }

  function toggleAllAddToGroupGames() {
    setAddToGroupSelection((current) => {
      const allVisibleSelected =
        addToGroupCandidates.length > 0 &&
        addToGroupCandidates.every((game) => current.has(game.id))
      const next = new Set(current)
      for (const game of addToGroupCandidates) {
        if (allVisibleSelected) next.delete(game.id)
        else next.add(game.id)
      }
      return next
    })
  }

  async function confirmAddToGroup() {
    if (!activeGroup || addToGroupSelection.size === 0) return
    setDialogError(null)
    try {
      await addGamesToGroup.mutateAsync({
        gameIds: [...addToGroupSelection],
        groupId: activeGroup.id,
      })
      setAddToGroupOpen(false)
      setAddToGroupSelection(new Set())
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : t('games.errors.addToGroupFailed'))
    }
  }

  async function confirmDeleteGame() {
    if (!pendingDeleteGame) return
    setDialogError(null)
    try {
      await deleteGame.mutateAsync(pendingDeleteGame.id)
      setPendingDeleteGame(null)
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : t('games.errors.deleteGameFailed'))
    }
  }

  async function confirmDeleteGroup() {
    if (!pendingDeleteGroup) return
    setDialogError(null)
    try {
      await deleteGroup.mutateAsync(pendingDeleteGroup.id)
      if (editingGroupId === pendingDeleteGroup.id) setEditingGroupId(null)
      setPendingDeleteGroup(null)
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : t('games.errors.deleteGroupFailed'))
    }
  }

  function toggleGroup(id: string) {
    // Flip what is on screen, not the raw map. A group nobody has touched has
    // no entry, so `!c[id]` read undefined as "expanded" and set it collapsed,
    // which is what it already looked like: in the All Groups view, where the
    // default is collapsed, the first click on a header did nothing and you
    // had to click twice to open it.
    setCollapsedGroups((c) => ({ ...c, [id]: !(c[id] ?? groupFilter === 'all') }))
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

  if (orgLoading) {
    return (
      <AdminPageShell
        title={t('games.title')}
        subtitle={
          isPlatformLibrary
            ? t('games.subtitlePlatform')
            : t('games.subtitleShort')
        }
      >
        <QueryLoading rows={6} />
      </AdminPageShell>
    )
  }

  if (!organizationId) {
    return (
      <AdminPageShell title={t('games.title')} subtitle={t('games.subtitleShort')}>
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  /**
   * Bulk permanent delete for the bin. One confirm for the whole set, not one
   * per game: a prompt per item trains people to click through without reading.
   * The RPC refuses anything still carrying submissions or event links, so a
   * partial failure is reported rather than swallowed.
   */
  async function purgeSelectedGames() {
    const ids = [...binSelected]
    if (ids.length === 0) return
    if (!window.confirm(t('games.bin.confirmPurge', { count: ids.length }))) {
      return
    }
    setPurgeError(null)
    const failures: string[] = []
    for (const id of ids) {
      try {
        await permanentlyDeleteGame.mutateAsync(id)
      } catch (err) {
        failures.push(err instanceof Error ? err.message : t('games.errors.deleteAGame'))
      }
    }
    setBinSelected(new Set())
    if (failures.length > 0) setPurgeError(failures[0])
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
      title={t('games.title')}
      subtitle={isPlatformLibrary ? t('games.subtitlePlatform') : t('games.subtitle')}
      actions={
        view === 'catalog' ? <>
          {/* Platform-only, and a page action like every other primary verb
              rather than a button floating above the card. */}
          {isPlatformLibrary ? (
            <NeoButton type="button" variant="surface" onClick={() => setInstallMusicOpen(true)}>
              {t('games.actions.installToClients')}
            </NeoButton>
          ) : null}
          <NeoButton type="button" variant="surface" onClick={() => musicRef.current?.openCreatePlaylist()}>
            {t('games.actions.newPlaylist')}
          </NeoButton>
          <NeoButton type="button" variant="accent" onClick={() => musicRef.current?.openUpload()}>
            {t('games.actions.uploadMusic')}
          </NeoButton>
        </> : view === 'inventory' && !isPlatformLibrary ? <>
          <NeoButton type="button" variant="surface" onClick={() => inventoryRef.current?.openCreateGroup()}>
            {t('games.actions.newGroup')}
          </NeoButton>
          <NeoButton type="button" variant="accent" onClick={() => inventoryRef.current?.openCreate()}>
            {t('games.actions.newItem')}
          </NeoButton>
        </> : view === 'bin' ? (
          <NeoButton
            type="button"
            variant="destructive"
            disabled={binSelected.size === 0}
            onClick={() => void purgeSelectedGames()}
          >
            {binSelected.size
              ? t('games.actions.deleteSelectedCount', { count: binSelected.size })
              : t('games.actions.deleteSelected')}
          </NeoButton>
        ) : view === 'games' ? <>
          {/* Only when one group is selected: in the All Groups view there is no
              single target to add to. */}
          {activeGroup ? (
            <NeoButton type="button" variant="surface" onClick={openAddToGroupDialog}>
              {t('games.actions.newGamesInGroup')}
            </NeoButton>
          ) : null}
          <NeoButton type="button" variant="surface" onClick={() => setImportOpen(true)}>
            {t('games.actions.import')}
          </NeoButton>
          <NeoButton type="button" variant="surface" onClick={openCreateGroupDialog}>
            {t('games.actions.newGroup')}
          </NeoButton>
          <NeoButton
            variant="accent"
            type="button"
            data-tour="new-game-button"
            onClick={() => setNewGameOpen(true)}
          >
            {t('games.actions.newGame')}
          </NeoButton>
        </> : undefined
      }
    >
      <div className="border-border mb-5 flex items-center justify-center gap-6 border-b" role="tablist" aria-label={t('games.tabs.ariaLabel')}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'games'}
          className={`relative px-1 pb-3 text-sm font-semibold transition-colors ${view === 'games' ? 'text-foreground after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setView('games')}
        >
          {t('games.tabs.gamesLibrary')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'catalog'}
          className={`relative px-1 pb-3 text-sm font-semibold transition-colors ${view === 'catalog' ? 'text-foreground after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setView('catalog')}
        >
          {t('games.tabs.musicLibrary')}
        </button>
        {!isPlatformLibrary ? (
          <button
            type="button"
            role="tab"
            aria-selected={view === 'inventory'}
            className={`relative px-1 pb-3 text-sm font-semibold transition-colors ${view === 'inventory' ? 'text-foreground after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setView('inventory')}
          >
            {t('games.tabs.inventoryLibrary')}
          </button>
        ) : null}
        <button
          type="button"
          role="tab"
          aria-selected={view === 'bin'}
          className={`relative px-1 pb-3 text-sm font-semibold transition-colors ${view === 'bin' ? 'text-foreground after:bg-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setView('bin')}
        >
          {trashedGamesQuery.data?.length
            ? t('games.tabs.deletedGamesCount', { count: trashedGamesQuery.data.length })
            : t('games.tabs.deletedGames')}
        </button>
      </div>

      {view === 'catalog' && organizationId ? (
        <MusicCatalogManager ref={musicRef} organizationId={organizationId} />
      ) : view === 'inventory' && organizationId && !isPlatformLibrary ? (
        <InventoryLibraryManager ref={inventoryRef} organizationId={organizationId} />
      ) : view === 'bin' ? (
        <>
          <div className="border-border/70 mb-5 flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
            {/* Identical to the Games Library toolbar: same pill styling and
                height, same filters / search / group order. */}
            <div className="flex flex-wrap gap-2 max-xl:justify-center">
              {FILTERS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${filter === value ? 'border-nm-slate-800 bg-nm-slate-800 text-white dark:border-nm-slate-700 dark:bg-nm-slate-700' : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'}`}
                  onClick={() => setFilter(value)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center max-xl:mx-auto max-xl:max-w-xl max-xl:justify-center xl:w-auto">
              <div className="relative min-w-52 flex-1">
                <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('games.bin.searchPlaceholder')}
                  className="bg-card h-9 pl-8 text-xs"
                />
              </div>
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="border-primary bg-primary text-primary-foreground h-9 min-w-44 rounded-md border px-3 text-xs font-semibold"
              >
                <option value="all">{t('games.filters.allGroups')}</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
          </div>
          {purgeError ? (
            <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30">
              {purgeError}
            </p>
          ) : null}
          <BinPanel
            items={filteredTrashed.map((g) => ({
              id: g.id,
              name: g.name,
              deletedAt: g.deleted_at!,
              coverUrl: g.cover_url,
              typeLabel: gameTypeLabel(g.type),
              groups: groups
                .filter((group) => group.items.some((i) => i.game_id === g.id))
                .map((group) => group.name),
              deletedByName: g.deleted_by_name,
              // The FK is nulled when the account goes, but the snapshot
              // remains, which is exactly how we know they were removed.
              deletedByRemoved: Boolean(g.deleted_by_name) && !g.deleted_by,
            }))}
            emptyLabel={(trashedGamesQuery.data ?? []).length === 0 ? t('games.bin.empty') : t('games.bin.emptyFiltered')}
            restoringId={restoreGame.isPending ? restoreGame.variables : undefined}
            deletingId={permanentlyDeleteGame.isPending ? permanentlyDeleteGame.variables : undefined}
            selectedIds={binSelected}
            onSelectedIdsChange={setBinSelected}
            onRestore={(id) => restoreGame.mutateAsync(id)}
            onDeletePermanently={async (id) => {
              setPurgeError(null)
              try {
                await permanentlyDeleteGame.mutateAsync(id)
              } catch (err) {
                setPurgeError(err instanceof Error ? err.message : t('games.errors.deleteThatGame'))
              }
            }}
            onOpen={(id) => navigate(orgPath(clientSlug, `/admin/games/${id}`))}
          />
        </>
      ) : (
      <>
      {/* The editor is a fixed overlay, so the list underneath keeps its own
          width. Reserving room for the panel used to reflow the card grid the
          moment it opened, which reshuffled every card the eye was already on. */}
      <div>
      <div className="border-border/70 mb-6 flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
        {/* Type filters, search, then group selector. Every control here is h-9
            so the row reads as one band rather than three different sizes. */}
        <div className="flex flex-wrap gap-2 max-xl:justify-center">
          {FILTERS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              className={`h-9 rounded-full border px-4 text-xs font-semibold transition-colors ${filter === value ? 'border-nm-slate-800 bg-nm-slate-800 text-white dark:border-nm-slate-700 dark:bg-nm-slate-700' : 'border-border bg-card text-muted-foreground hover:border-nm-slate-400 hover:text-foreground'}`}
              onClick={() => setFilter(value)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center max-xl:mx-auto max-xl:max-w-xl max-xl:justify-center xl:w-auto">
          <div className="relative min-w-52 flex-1">
            <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('games.searchPlaceholder')}
              className="bg-card h-9 pl-8 text-xs"
            />
          </div>
          <select
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value)
              // Collapse state is per view: picking a group should always show
              // its games, whatever was collapsed in the All Groups view.
              setCollapsedGroups({})
            }}
            className="border-primary bg-primary text-primary-foreground h-9 min-w-44 rounded-md border px-3 text-xs font-semibold"
          >
            <option value="all">{t('games.filters.allGroups')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          {!isPlatformLibrary ? (
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'manual' | 'status')}
              aria-label={t('games.sort.ariaLabel')}
              className="border-input bg-card text-foreground h-9 min-w-40 rounded-md border px-3 text-xs font-semibold"
            >
              <option value="manual">{t('games.sort.manual')}</option>
              <option value="status">{t('games.sort.byStatus')}</option>
            </select>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <QueryLoading rows={6} />
      ) : gamesQuery.isError ? (
        <QueryError message={gamesQuery.error.message} />
      ) : filtered.length === 0 && groups.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
          <IconPhoto className="text-muted-foreground size-10 opacity-60" />
          <p className="text-foreground font-medium">{t('games.emptyTitle')}</p>
          <NeoButton variant="accent" type="button" className="mt-2" onClick={() => setNewGameOpen(true)}>
            {t('games.createNewGame')}
          </NeoButton>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.filter((group) => groupFilter === 'all' || group.id === groupFilter).map((group) => {
            const groupGames = filtered.filter(
              (g) => gameToGroupIds.get(g.id)?.has(group.id),
            )
            // Absent = use the view default: collapsed when browsing all
            // groups so the page stays scannable, expanded when one is picked.
            const collapsed = collapsedGroups[group.id] ?? groupFilter === 'all'
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
                  onDelete={() => {
                    setDialogError(null)
                    setPendingDeleteGroup({ id: group.id, name: group.name })
                  }}
                  onInstall={
                    isPlatformLibrary && group.items.length > 0
                      ? () => openInstallGroup(group)
                      : undefined
                  }
                />
                {!collapsed ? (
                  groupGames.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('games.groups.emptyGroup')}</p>
                  ) : (
                    <DraggableGamesGrid
                      games={groupGames}
                      groupNamesByGame={groupNamesByGame}
                      deleting={deleteGame.isPending}
                      onDuplicate={(game) => void handleDuplicateGame(game)}
                      onDelete={(game) => {
                        setDialogError(null)
                        setPendingDeleteGame({ id: game.id, name: game.name })
                      }}
                      onReorder={handleReorder}
                      onEdit={openGameEditor}
                      onInstall={
                        isPlatformLibrary ? (game) => setInstallGame(game) : undefined
                      }
                      sortMode={sortMode}
                      showPrepStatus={!isPlatformLibrary}
                      onPrepStatusChange={(id, status) =>
                        void updatePrepStatus.mutateAsync({ gameId: id, prepStatus: status })
                      }
                      prepStatusPending={updatePrepStatus.isPending}
                    />
                  )
                ) : null}
              </section>
            )
          })}

          {groupFilter === 'all' && ungrouped.length > 0 ? (
            <section>
              <h2 className="text-foreground mb-2 text-sm font-semibold">
                {t('games.groups.ungrouped')}
                <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
                  {ungrouped.length}
                </span>
              </h2>
              <DraggableGamesGrid
                games={ungrouped}
                groupNamesByGame={groupNamesByGame}
                deleting={deleteGame.isPending}
                onDuplicate={(game) => void handleDuplicateGame(game)}
                onDelete={(game) => {
                  setDialogError(null)
                  setPendingDeleteGame({ id: game.id, name: game.name })
                }}
                onReorder={handleReorder}
                onEdit={openGameEditor}
                onInstall={isPlatformLibrary ? (game) => setInstallGame(game) : undefined}
                sortMode={sortMode}
                showPrepStatus={!isPlatformLibrary}
                onPrepStatusChange={(id, status) =>
                  void updatePrepStatus.mutateAsync({ gameId: id, prepStatus: status })
                }
                prepStatusPending={updatePrepStatus.isPending}
              />
            </section>
          ) : null}
        </div>
      )}
      </div>
      {installGame ? (
        <InstallGameModal game={installGame} onClose={() => setInstallGame(null)} />
      ) : null}

      {installMusicOpen ? (
        <InstallMusicLibraryModal onClose={() => setInstallMusicOpen(false)} />
      ) : null}

      <NewGameTypeModal open={newGameOpen} onClose={() => setNewGameOpen(false)} />

      {importOpen && organizationId ? (
        <GameImportModal
          organizationId={organizationId}
          isPlatformLibrary={isPlatformLibrary}
          groups={groups}
          onClose={() => setImportOpen(false)}
        />
      ) : null}

      {installGroup ? (
        <InstallGameGroupModal
          groupName={installGroup.name}
          games={installGroup.games}
          onClose={() => setInstallGroup(null)}
        />
      ) : null}

      {createGroupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-group-title"
        >
          <Card className="border-nm-slate-800 flex max-h-[min(760px,92vh)] w-full max-w-2xl flex-col overflow-hidden border-2 bg-card shadow-lg">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            <div className="space-y-2">
              <h3 id="create-group-title" className="text-foreground font-semibold">
                {t('games.createGroup.title')}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t('games.createGroup.description')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-group-name">{t('games.createGroup.nameLabel')}</Label>
              <Input
                id="new-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void confirmCreateGroup()
                  if (e.key === 'Escape') setCreateGroupOpen(false)
                }}
                placeholder={t('games.createGroup.namePlaceholder')}
                className="bg-background"
                autoFocus
              />
            </div>
            {allGames.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    value={createGroupSource}
                    onChange={(event) => setCreateGroupSource(event.target.value)}
                    aria-label={t('games.createGroup.sourceAriaLabel')}
                    className="border-input bg-background h-9 min-w-40 rounded-md border px-2 text-xs font-semibold"
                  >
                    <option value="all">{t('games.filters.allGroups')}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map(({ value, labelKey }) => (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${createGroupType === value ? 'border-nm-slate-800 bg-nm-slate-800 text-white' : 'border-border text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setCreateGroupType(value)}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                  <div className="relative min-w-48 flex-1">
                    <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                    <Input
                      value={createGroupSearch}
                      onChange={(event) => setCreateGroupSearch(event.target.value)}
                      placeholder={t('games.searchPlaceholder')}
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={
                      createGroupCandidates.length > 0 &&
                      createGroupCandidates.every((game) => createGroupSelection.has(game.id))
                    }
                    onChange={toggleAllCreateGroupGames}
                  />
                  {t('games.selectAllVisible', { count: createGroupCandidates.length })}
                </label>
                <div className="divide-border max-h-64 overflow-y-auto rounded-md border">
                  {createGroupCandidates.map((game) => {
                    const currentGroup = groups.find((group) => gameToGroupIds.get(game.id)?.has(group.id))
                    return (
                      <label key={game.id} className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={createGroupSelection.has(game.id)}
                          onChange={() => toggleCreateGroupGame(game.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-sm font-semibold">{game.name}</span>
                          <span className="text-muted-foreground block text-xs">
                            {gameTypeLabel(game.type)}
                            {currentGroup
                              ? ` · ${t('games.currentlyIn', { name: currentGroup.name })}`
                              : ` · ${t('games.groups.ungrouped')}`}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                  {createGroupCandidates.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-8 text-center text-sm">{t('games.noGamesMatchFilters')}</p>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('games.createGroup.membershipNote')}
                </p>
              </div>
            ) : null}
            {dialogError ? (
              <p className="text-destructive text-sm" role="alert">
                {dialogError}
              </p>
            ) : null}
            </div>
            <div className="border-border flex items-center justify-between gap-3 border-t p-5">
              <p className="text-muted-foreground text-xs">{t('games.createGroup.selectedCount', { count: createGroupSelection.size })}</p>
              <div className="flex gap-2">
              <NeoButton
                type="button"
                variant="surface"
                disabled={createGroup.isPending || addGamesToGroup.isPending}
                onClick={() => {
                  setDialogError(null)
                  setCreateGroupOpen(false)
                }}
              >
                {t('common:cancel')}
              </NeoButton>
              <NeoButton
                type="button"
                variant="primary"
                disabled={createGroup.isPending || addGamesToGroup.isPending}
                onClick={() => void confirmCreateGroup()}
              >
                {createGroup.isPending || addGamesToGroup.isPending
                  ? t('games.createGroup.creating')
                  : t('games.createGroup.submit')}
              </NeoButton>
              </div>
            </div>
          </Card>
        </div>
      ) : null}


      {addToGroupOpen && activeGroup ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-games-to-group-title"
        >
          <Card className="border-nm-slate-800 flex max-h-[min(720px,90vh)] w-full max-w-2xl flex-col overflow-hidden border-2 bg-card shadow-lg">
            <div className="border-border border-b p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="add-games-to-group-title" className="text-foreground font-semibold">
                    {t('games.addToGroup.title', { name: activeGroup.name })}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('games.addToGroup.description')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('common:close')}
                  className="text-muted-foreground hover:text-foreground rounded-md p-1"
                  onClick={() => setAddToGroupOpen(false)}
                >
                  <IconClose className="size-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map(({ value, labelKey }) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${addToGroupType === value ? 'border-nm-slate-800 bg-nm-slate-800 text-white' : 'border-border text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setAddToGroupType(value)}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-48 flex-1">
                  <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    value={addToGroupSearch}
                    onChange={(event) => setAddToGroupSearch(event.target.value)}
                    placeholder={t('games.searchPlaceholder')}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <label className="mb-3 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={
                    addToGroupCandidates.length > 0 &&
                    addToGroupCandidates.every((game) => addToGroupSelection.has(game.id))
                  }
                  onChange={toggleAllAddToGroupGames}
                />
                {t('games.selectAllVisible', { count: addToGroupCandidates.length })}
              </label>
              <div className="divide-border overflow-hidden rounded-md border">
                {addToGroupCandidates.map((game) => {
                  const currentGroup = groups.find((group) => gameToGroupIds.get(game.id)?.has(group.id))
                  return (
                    <label key={game.id} className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 border-b px-3 py-3 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={addToGroupSelection.has(game.id)}
                        onChange={() => toggleAddToGroupGame(game.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate text-sm font-semibold">{game.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {gameTypeLabel(game.type)}
                          {currentGroup
                            ? ` · ${t('games.currentlyIn', { name: currentGroup.name })}`
                            : ` · ${t('games.groups.ungrouped')}`}
                        </span>
                      </span>
                    </label>
                  )
                })}
                {addToGroupCandidates.length === 0 ? (
                  <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                    {t('games.noGamesMatchFilters')}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="border-border flex items-center justify-between gap-3 border-t p-5">
              <p className="text-muted-foreground text-xs">{t('games.addToGroup.selectedCount', { count: addToGroupSelection.size })}</p>
              <div className="flex gap-2">
                <NeoButton type="button" variant="surface" disabled={addGamesToGroup.isPending} onClick={() => setAddToGroupOpen(false)}>
                  {t('common:cancel')}
                </NeoButton>
                <NeoButton type="button" variant="primary" disabled={addToGroupSelection.size === 0 || addGamesToGroup.isPending} onClick={() => void confirmAddToGroup()}>
                  {addGamesToGroup.isPending
                    ? t('games.addToGroup.adding')
                    : t('games.addToGroup.submit', { count: addToGroupSelection.size })}
                </NeoButton>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {pendingDeleteGame ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-game-title"
          aria-describedby="delete-game-message"
        >
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <div className="space-y-2">
              <h3 id="delete-game-title" className="text-foreground font-semibold">
                {t('games.deleteGame.title')}
              </h3>
              <p id="delete-game-message" className="text-muted-foreground text-sm leading-relaxed">
                <Trans
                  t={t}
                  i18nKey="games.deleteGame.message"
                  values={{ name: pendingDeleteGame.name }}
                  components={{ strong: <span className="text-foreground font-medium" /> }}
                />
              </p>
            </div>
            {dialogError ? (
              <p className="text-destructive text-sm" role="alert">
                {dialogError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <NeoButton
                type="button"
                variant="surface"
                disabled={deleteGame.isPending}
                onClick={() => {
                  setDialogError(null)
                  setPendingDeleteGame(null)
                }}
              >
                {t('common:cancel')}
              </NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={deleteGame.isPending}
                onClick={() => void confirmDeleteGame()}
              >
                {deleteGame.isPending ? t('games.deleting') : t('games.deleteGame.submit')}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}

      {pendingDeleteGroup ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-group-title"
          aria-describedby="delete-group-message"
        >
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <div className="space-y-2">
              <h3 id="delete-group-title" className="text-foreground font-semibold">
                {t('games.deleteGroup.title')}
              </h3>
              <p id="delete-group-message" className="text-muted-foreground text-sm leading-relaxed">
                <Trans
                  t={t}
                  i18nKey="games.deleteGroup.message"
                  values={{ name: pendingDeleteGroup.name }}
                  components={{ strong: <span className="text-foreground font-medium" /> }}
                />
              </p>
            </div>
            {dialogError ? (
              <p className="text-destructive text-sm" role="alert">
                {dialogError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <NeoButton
                type="button"
                variant="surface"
                disabled={deleteGroup.isPending}
                onClick={() => {
                  setDialogError(null)
                  setPendingDeleteGroup(null)
                }}
              >
                {t('common:cancel')}
              </NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={deleteGroup.isPending}
                onClick={() => void confirmDeleteGroup()}
              >
                {deleteGroup.isPending ? t('games.deleting') : t('games.deleteGroup.submit')}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}

      {editingGameId ? (
        <GameEditPanel gameId={editingGameId} onClose={() => setEditingGameId(null)} />
      ) : null}
      </>
      )}
    </AdminPageShell>
  )
}
