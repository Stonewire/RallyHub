import { ImagePlus } from 'lucide-react'
import { IconCheck, IconClose, IconCopy, IconDownload, IconEdit, IconInventory, IconLayers, IconSearch, IconTrash } from '@/components/icons'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton, NeoInput, NeoLabel, NeoTextarea } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type InventoryItem,
  useDeleteInventoryItem,
  useDuplicateInventoryItem,
  useInventoryItems,
  useSaveInventoryItem,
} from '@/hooks/use-inventory'
import {
  useCreateInventoryGroup,
  useDeleteInventoryGroup,
  useInventoryGroups,
  useRenameInventoryGroup,
  useSetItemGroups,
} from '@/hooks/use-inventory-groups'
import { useOrganization } from '@/hooks/use-organization-settings'
import { qrCodeUrl } from '@/lib/event-links'
import {
  downloadInventoryQrPng,
  downloadInventoryQrsPdf,
  getInventoryItemLink,
} from '@/lib/inventory-links'

type ItemForm = {
  name: string
  description: string
  pointsCost: string
  image: File | null
  removeImage: boolean
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  pointsCost: '',
  image: null,
  removeImage: false,
}

export type InventoryLibraryHandle = {
  openCreate: () => void
  openCreateGroup: () => void
  exportAll: () => void
  canExport: boolean
}

export const InventoryLibraryManager = forwardRef<
  InventoryLibraryHandle,
  { organizationId: string }
>(function InventoryLibraryManager({ organizationId }, ref) {
  const itemsQuery = useInventoryItems(organizationId)
  const organizationQuery = useOrganization(organizationId)
  const saveItem = useSaveInventoryItem(organizationId)
  const deleteItem = useDeleteInventoryItem(organizationId)
  const duplicateItem = useDuplicateInventoryItem(organizationId)
  const groupsQuery = useInventoryGroups(organizationId)
  const createGroup = useCreateInventoryGroup(organizationId)
  const renameGroup = useRenameInventoryGroup(organizationId)
  const deleteGroup = useDeleteInventoryGroup(organizationId)
  const setItemGroups = useSetItemGroups(organizationId)
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupPicks, setNewGroupPicks] = useState<Set<string>>(new Set())
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingGroupDelete, setPendingGroupDelete] = useState<string | null>(null)
  const [formGroups, setFormGroups] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<InventoryItem | null | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const groupsByItem = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const group of groups) {
      for (const itemId of group.itemIds) {
        map.set(itemId, [...(map.get(itemId) ?? []), group.name])
      }
    }
    return map
  }, [groups])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const group = activeGroup ? groups.find((g) => g.id === activeGroup) : null
    const inGroup = group ? new Set(group.itemIds) : null
    return items.filter((item) => {
      if (inGroup && !inGroup.has(item.id)) return false
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        Boolean(item.description?.toLowerCase().includes(query))
      )
    })
  }, [items, search, activeGroup, groups])

  const preview = useMemo(
    () => (form.image ? URL.createObjectURL(form.image) : null),
    [form.image],
  )
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    // A new item lands in whichever group is being viewed, which is what
    // "add an item while looking at a group" is asking for.
    setFormGroups(new Set(activeGroup ? [activeGroup] : []))
    setError(null)
  }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description ?? '',
      pointsCost: String(item.points_cost),
      image: null,
      removeImage: false,
    })
    setFormGroups(new Set(groups.filter((g) => g.itemIds.includes(item.id)).map((g) => g.id)))
    setError(null)
  }

  function openCreateGroup() {
    setNewGroupName('')
    setNewGroupPicks(new Set())
    setError(null)
    setCreateGroupOpen(true)
  }

  async function submitGroup() {
    const name = newGroupName.trim()
    if (!name) {
      setError('Enter a group name.')
      return
    }
    setError(null)
    try {
      await createGroup.mutateAsync({ name, itemIds: [...newGroupPicks] })
      setCreateGroupOpen(false)
      setMessage(`Group "${name}" created.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the group.')
    }
  }

  async function confirmGroupDelete() {
    if (!pendingGroupDelete) return
    setError(null)
    try {
      await deleteGroup.mutateAsync(pendingGroupDelete)
      if (activeGroup === pendingGroupDelete) setActiveGroup(null)
      setPendingGroupDelete(null)
      setMessage('Group deleted. The items themselves are untouched.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the group.')
    }
  }

  async function duplicate(item: InventoryItem) {
    setError(null)
    try {
      const copy = await duplicateItem.mutateAsync(item)
      // The copy joins the same groups, so a duplicate made inside a group
      // stays where it was made.
      const groupIds = groups.filter((g) => g.itemIds.includes(item.id)).map((g) => g.id)
      if (groupIds.length > 0 && copy?.id) {
        await setItemGroups.mutateAsync({ itemId: copy.id, groupIds })
      }
      setMessage(`"${item.name}" duplicated with its own QR code.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not duplicate the item.')
    }
  }

  async function submit() {
    const cost = Number(form.pointsCost)
    if (!form.name.trim()) {
      setError('Enter an item name.')
      return
    }
    if (!Number.isInteger(cost) || cost <= 0) {
      setError('Point cost must be a whole number greater than zero.')
      return
    }
    setError(null)
    try {
      const saved = await saveItem.mutateAsync({
        id: editing?.id,
        name: form.name,
        description: form.description || null,
        pointsCost: cost,
        image: form.image,
        removeImage: form.removeImage,
      })
      if (saved?.id) {
        await setItemGroups.mutateAsync({ itemId: saved.id, groupIds: [...formGroups] })
      }
      setEditing(undefined)
      setMessage(editing ? 'Item updated.' : 'Item created and QR code generated.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the item.')
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setError(null)
    try {
      await deleteItem.mutateAsync(pendingDelete)
      setPendingDelete(null)
      setMessage('Item deleted. Existing purchase records remain in the event history.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the item.')
    }
  }

  async function exportPdf(exportItems: InventoryItem[]) {
    setExporting(true)
    setError(null)
    try {
      await downloadInventoryQrsPdf(
        exportItems,
        organizationQuery.data?.name ?? 'RallyHub',
      )
      setMessage(`${exportItems.length} QR code${exportItems.length === 1 ? '' : 's'} exported.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export QR codes.')
    } finally {
      setExporting(false)
    }
  }

  useImperativeHandle(ref, () => ({
    openCreate,
    openCreateGroup,
    // Exports what is on screen: with a group selected that is the group, and
    // with a search running it is the matches, which is what "download these"
    // means while looking at them.
    exportAll: () => void exportPdf(filtered),
    canExport: filtered.length > 0 && !exporting,
  }))

  if (itemsQuery.isLoading) return <QueryLoading rows={6} />
  if (itemsQuery.isError) return <QueryError message={itemsQuery.error.message} />

  return (
    <div className={editing !== undefined ? "space-y-5 xl:pr-[36rem]" : "space-y-5"}>
      {message ? (
        <div className="border-border bg-card flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><IconCheck className="size-4 text-emerald-600" />{message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)}><IconClose className="size-4" /></button>
        </div>
      ) : null}
      {error && editing === undefined && !pendingDelete ? (
        <p className="text-destructive text-sm" role="alert">{error}</p>
      ) : null}

      {/* Search and group filter are the Games Library controls, same classes,
          so the two tabs are the same toolbar. */}
      <div className="border-border/70 flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center">
        <div className="relative min-w-52 sm:max-w-sm sm:flex-1">
          <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <NeoInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search inventory…"
            className="bg-card h-9 pl-8 text-xs"
          />
        </div>
        <select
          aria-label="Filter by group"
          value={activeGroup ?? 'all'}
          onChange={(event) =>
            setActiveGroup(event.target.value === 'all' ? null : event.target.value)
          }
          className="border-primary bg-primary text-primary-foreground h-9 min-w-44 rounded-md border px-3 text-xs font-semibold"
        >
          <option value="all">All Groups</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        {groups.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {renamingGroup ? (
              <>
                <NeoInput
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="h-9 w-40 text-xs"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setRenamingGroup(null)
                    if (event.key === 'Enter' && renameValue.trim()) {
                      void renameGroup
                        .mutateAsync({ groupId: renamingGroup, name: renameValue })
                        .then(() => setRenamingGroup(null))
                        .catch((reason) => setError(String(reason)))
                    }
                  }}
                />
                <NeoButton
                  type="button"
                  variant="surface"
                  size="sm"
                  disabled={!renameValue.trim()}
                  onClick={() =>
                    void renameGroup
                      .mutateAsync({ groupId: renamingGroup, name: renameValue })
                      .then(() => setRenamingGroup(null))
                      .catch((reason) => setError(String(reason)))
                  }
                >
                  Save
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenamingGroup(null)}
                >
                  Cancel
                </NeoButton>
              </>
            ) : activeGroup ? (
              <>
                <NeoButton
                  type="button"
                  variant="surface"
                  size="sm"
                  onClick={() => {
                    setRenameValue(groups.find((g) => g.id === activeGroup)?.name ?? '')
                    setRenamingGroup(activeGroup)
                  }}
                >
                  Rename
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setPendingGroupDelete(activeGroup)}
                >
                  Delete group
                </NeoButton>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <IconInventory className="text-muted-foreground size-11" />
          <h3 className="font-semibold">No inventory items yet</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            Add your first physical item. Its reusable purchase link and QR code are created automatically.
          </p>
          <NeoButton type="button" variant="accent" onClick={openCreate}>Add first item</NeoButton>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center"><p className="text-muted-foreground text-sm">No matching items.</p></Card>
      ) : (
        // Same grid as the Games Library so the two tabs read as one system.
        // Actions are icons for the same reason a game card uses icons: four
        // labelled buttons cannot fit a 9rem card.
        <div className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
          {filtered.map((item) => {
            const link = getInventoryItemLink(item.public_code)
            return (
              <Card
                key={item.id}
                onClick={() => openEdit(item)}
                className="border-border/80 group flex cursor-pointer flex-col overflow-hidden p-0 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-nm-slate-400 hover:shadow-md"
              >
                <div className="bg-muted relative aspect-[4/3] w-full shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center">
                      <IconInventory className="size-7" />
                    </div>
                  )}
                  <img
                    src={qrCodeUrl(link, 120)}
                    alt={`QR code for ${item.name}`}
                    className="absolute right-1 bottom-1 size-9 rounded border bg-white p-0.5"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
                  <h3 className="truncate text-xs font-semibold">{item.name}</h3>
                  {groupsByItem.get(item.id)?.length ? (
                    <span className="text-muted-foreground truncate text-[10px]">
                      {groupsByItem.get(item.id)!.join(', ')}
                    </span>
                  ) : null}
                  {/* Red, and labelled Cost, because this DEDUCTS a team's points.
                      Shares the destructive colour deliberately. */}
                  <span className="text-destructive text-xs font-bold">
                    Cost {item.points_cost} pts
                  </span>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <button
                      type="button"
                      title="Copy item link"
                      aria-label={`Copy link for ${item.name}`}
                      className="text-muted-foreground hover:text-foreground p-1"
                      onClick={(event) => {
                        event.stopPropagation()
                        void navigator.clipboard.writeText(link)
                          .then(() => setMessage('Item link copied.'))
                          .catch(() => setError('Could not copy the item link.'))
                      }}
                    >
                      <IconCopy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Download QR PNG"
                      aria-label={`Download QR code for ${item.name}`}
                      className="text-muted-foreground hover:text-foreground p-1"
                      onClick={(event) => {
                        event.stopPropagation()
                        void downloadInventoryQrPng(item).catch((reason) => setError(String(reason)))
                      }}
                    >
                      <IconDownload className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Duplicate item"
                      aria-label={`Duplicate ${item.name}`}
                      className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-40"
                      disabled={duplicateItem.isPending}
                      onClick={(event) => {
                        event.stopPropagation()
                        void duplicate(item)
                      }}
                    >
                      <IconLayers className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Edit item"
                      aria-label={`Edit ${item.name}`}
                      className="text-muted-foreground hover:text-foreground p-1"
                      onClick={(event) => {
                        event.stopPropagation()
                        openEdit(item)
                      }}
                    >
                      <IconEdit className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete item"
                      aria-label={`Delete ${item.name}`}
                      className="text-destructive p-1 hover:opacity-70"
                      onClick={(event) => {
                        event.stopPropagation()
                        setError(null)
                        setPendingDelete(item)
                      }}
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Side panel, not a modal, matching GameEditPanel: the list stays visible
          and clicking another item just swaps the panel contents. */}
      {editing !== undefined ? (
        <div
          className="border-nm-slate-800 bg-background fixed inset-y-0 right-0 z-40 flex w-full max-w-[35rem] flex-col overflow-y-auto border-l-2 p-6 shadow-2xl"
          role="dialog"
          aria-labelledby="inventory-item-title"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="inventory-item-title" className="text-lg font-semibold">{editing ? 'Edit item' : 'Add inventory item'}</h3>
                <p className="text-muted-foreground mt-1 text-sm">The QR code will always use the current name, description, and point cost.</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setEditing(undefined)}>
                <IconClose className="size-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <NeoLabel htmlFor="inventory-name">Name *</NeoLabel>
              <NeoInput id="inventory-name" maxLength={120} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <NeoLabel htmlFor="inventory-description">Description (optional)</NeoLabel>
              <NeoTextarea id="inventory-description" maxLength={1000} rows={4} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <NeoLabel htmlFor="inventory-points">Point cost *</NeoLabel>
              <NeoInput id="inventory-points" type="number" min={1} step={1} value={form.pointsCost} onChange={(event) => setForm((value) => ({ ...value, pointsCost: event.target.value }))} />
            </div>
            {groups.length > 0 ? (
              <div className="space-y-2">
                <NeoLabel>Groups</NeoLabel>
                <div className="border-border grid gap-1.5 rounded-lg border p-3">
                  {groups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formGroups.has(group.id)}
                        onChange={() =>
                          setFormGroups((current) => {
                            const next = new Set(current)
                            if (next.has(group.id)) next.delete(group.id)
                            else next.add(group.id)
                            return next
                          })
                        }
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <NeoLabel htmlFor="inventory-image">Photo (optional)</NeoLabel>
              <label htmlFor="inventory-image" className="border-border bg-muted/30 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4">
                <ImagePlus className="text-muted-foreground size-5" />
                <span className="text-sm">{form.image?.name ?? 'Choose an image'}</span>
              </label>
              <input id="inventory-image" type="file" accept="image/*" className="sr-only" onChange={(event) => setForm((value) => ({ ...value, image: event.target.files?.[0] ?? null, removeImage: false }))} />
              {(preview || (editing?.image_url && !form.removeImage)) ? (
                <div className="flex items-center gap-3">
                  <img src={preview ?? editing?.image_url ?? ''} alt="Item preview" className="size-24 rounded-lg object-cover" />
                  <NeoButton type="button" size="sm" variant="ghost" onClick={() => setForm((value) => ({ ...value, image: null, removeImage: true }))}>Remove photo</NeoButton>
                </div>
              ) : null}
            </div>
            {/* Only for a saved item: a new one has no public_code yet, so there
                is no link to encode and nothing to download. */}
            {editing ? (
              <div className="border-border space-y-2 border-t pt-4">
                <NeoLabel>QR code</NeoLabel>
                <div className="flex items-center gap-4">
                  <img
                    src={qrCodeUrl(getInventoryItemLink(editing.public_code), 220)}
                    alt={`QR code for ${editing.name}`}
                    className="size-28 rounded border bg-white p-1"
                  />
                  <NeoButton
                    type="button"
                    variant="surface"
                    onClick={() => void downloadInventoryQrPng(editing).catch((reason) => setError(String(reason)))}
                  >
                    <IconDownload className="size-4" />
                    Download QR PNG
                  </NeoButton>
                </div>
              </div>
            ) : null}
            {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" disabled={saveItem.isPending} onClick={() => setEditing(undefined)}>Cancel</NeoButton>
              <NeoButton type="button" variant="primary" disabled={saveItem.isPending} onClick={() => void submit()}>{saveItem.isPending ? 'Saving…' : 'Save item'}</NeoButton>
            </div>
          </div>
        </div>
      ) : null}

      {createGroupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <Card className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 p-6 shadow-xl">
            <h3 className="text-lg font-semibold">New inventory group</h3>
            <NeoInput
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Group name"
              maxLength={80}
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              Pick the items to start it with. You can change this later from any item.
            </p>
            <ul className="border-border min-h-0 flex-1 space-y-1 overflow-auto rounded-lg border p-2">
              {items.map((item) => (
                <li key={item.id}>
                  <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={newGroupPicks.has(item.id)}
                      onChange={() =>
                        setNewGroupPicks((current) => {
                          const next = new Set(current)
                          if (next.has(item.id)) next.delete(item.id)
                          else next.add(item.id)
                          return next
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="text-muted-foreground text-xs">{item.points_cost} pts</span>
                  </label>
                </li>
              ))}
              {items.length === 0 ? (
                <li className="text-muted-foreground px-2 py-1.5 text-sm">No items yet.</li>
              ) : null}
            </ul>
            {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">{newGroupPicks.size} selected</p>
              <div className="flex gap-2">
                <NeoButton type="button" variant="surface" onClick={() => setCreateGroupOpen(false)}>
                  Cancel
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="primary"
                  disabled={!newGroupName.trim() || createGroup.isPending}
                  onClick={() => void submitGroup()}
                >
                  {createGroup.isPending ? 'Creating…' : 'Create group'}
                </NeoButton>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {pendingGroupDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="alertdialog" aria-modal="true">
          <Card className="w-full max-w-md space-y-4 p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              Delete {groups.find((g) => g.id === pendingGroupDelete)?.name}?
            </h3>
            <p className="text-muted-foreground text-sm">
              Only the group goes. Every item in it stays in your inventory.
            </p>
            {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" disabled={deleteGroup.isPending} onClick={() => setPendingGroupDelete(null)}>Cancel</NeoButton>
              <NeoButton type="button" variant="destructive" disabled={deleteGroup.isPending} onClick={() => void confirmGroupDelete()}>{deleteGroup.isPending ? 'Deleting…' : 'Delete group'}</NeoButton>
            </div>
          </Card>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="alertdialog" aria-modal="true">
          <Card className="w-full max-w-md space-y-4 p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Delete {pendingDelete.name}?</h3>
            <p className="text-muted-foreground text-sm">Its QR code will stop working. Past purchase records will be kept for event history.</p>
            {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" disabled={deleteItem.isPending} onClick={() => setPendingDelete(null)}>Cancel</NeoButton>
              <NeoButton type="button" variant="destructive" disabled={deleteItem.isPending} onClick={() => void confirmDelete()}>{deleteItem.isPending ? 'Deleting…' : 'Delete item'}</NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
})
