import {
  Check,
  Copy,
  Download,
  FileDown,
  ImagePlus,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton, NeoInput, NeoLabel, NeoTextarea } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import {
  type InventoryItem,
  useDeleteInventoryItem,
  useInventoryItems,
  useSaveInventoryItem,
} from '@/hooks/use-inventory'
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

export function InventoryLibraryManager({ organizationId }: { organizationId: string }) {
  const itemsQuery = useInventoryItems(organizationId)
  const organizationQuery = useOrganization(organizationId)
  const saveItem = useSaveInventoryItem(organizationId)
  const deleteItem = useDeleteInventoryItem(organizationId)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<InventoryItem | null | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    )
  }, [items, search])
  const selectedItems = items.filter((item) => selected.has(item.id))

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
    setError(null)
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
      await saveItem.mutateAsync({
        id: editing?.id,
        name: form.name,
        description: form.description || null,
        pointsCost: cost,
        image: form.image,
        removeImage: form.removeImage,
      })
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
      setSelected((current) => {
        const next = new Set(current)
        next.delete(pendingDelete.id)
        return next
      })
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

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (itemsQuery.isLoading) return <QueryLoading rows={6} />
  if (itemsQuery.isError) return <QueryError message={itemsQuery.error.message} />

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Inventory Library</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Create physical items that teams can buy with their event points.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NeoButton
            type="button"
            variant="surface"
            disabled={selectedItems.length === 0 || exporting}
            onClick={() => void exportPdf(selectedItems)}
          >
            <FileDown className="size-4" />
            Export selected {selectedItems.length ? `(${selectedItems.length})` : ''}
          </NeoButton>
          <NeoButton
            type="button"
            variant="surface"
            disabled={items.length === 0 || exporting}
            onClick={() => void exportPdf(items)}
          >
            <Download className="size-4" />
            Export all
          </NeoButton>
          <NeoButton type="button" variant="accent" onClick={openCreate}>
            <Plus className="size-4" />
            Add item
          </NeoButton>
        </div>
      </div>

      {message ? (
        <div className="border-border bg-card flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)}><X className="size-4" /></button>
        </div>
      ) : null}
      {error && editing === undefined && !pendingDelete ? (
        <p className="text-destructive text-sm" role="alert">{error}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <NeoInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search inventory…"
            className="pl-9"
          />
        </div>
        {filtered.length > 0 ? (
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filtered.every((item) => selected.has(item.id))}
              onChange={(event) => {
                setSelected((current) => {
                  const next = new Set(current)
                  for (const item of filtered) {
                    if (event.target.checked) next.add(item.id)
                    else next.delete(item.id)
                  }
                  return next
                })
              }}
              className="size-4 accent-amber-400"
            />
            Select visible
          </label>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Card className="border-border/80 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <PackageOpen className="text-muted-foreground size-11" />
          <h3 className="font-semibold">No inventory items yet</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            Add your first physical item. Its reusable purchase link and QR code are created automatically.
          </p>
          <NeoButton type="button" variant="accent" onClick={openCreate}>Add first item</NeoButton>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center"><p className="text-muted-foreground text-sm">No matching items.</p></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => {
            const link = getInventoryItemLink(item.public_code)
            return (
              <Card key={item.id} className="border-border/80 p-4 shadow-sm">
                <div className="flex gap-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.name}`}
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    className="mt-1 size-4 shrink-0 accent-amber-400"
                  />
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="size-24 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-lg">
                      <PackageOpen className="size-8" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="truncate font-semibold">{item.name}</h3>
                        <span className="mt-1 inline-block rounded-full bg-amber-300 px-2.5 py-1 text-xs font-bold text-neutral-900">
                          {item.points_cost} points
                        </span>
                      </div>
                      <img src={qrCodeUrl(link, 160)} alt={`QR code for ${item.name}`} className="size-20 rounded border bg-white p-1" />
                    </div>
                    {item.description ? <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{item.description}</p> : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-3">
                  <NeoButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void navigator.clipboard.writeText(link)
                      .then(() => setMessage('Item link copied.'))
                      .catch(() => setError('Could not copy the item link.'))}
                  >
                    <Copy className="size-4" /> Copy link
                  </NeoButton>
                  <NeoButton type="button" size="sm" variant="surface" onClick={() => void downloadInventoryQrPng(item).catch((reason) => setError(String(reason)))}>
                    <Download className="size-4" /> QR PNG
                  </NeoButton>
                  <NeoButton type="button" size="sm" variant="surface" onClick={() => openEdit(item)}>
                    <Pencil className="size-4" /> Edit
                  </NeoButton>
                  <NeoButton type="button" size="sm" variant="destructive" onClick={() => { setError(null); setPendingDelete(item) }}>
                    <Trash2 className="size-4" /> Delete
                  </NeoButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing !== undefined ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="inventory-item-title">
          <Card className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6 shadow-xl">
            <div>
              <h3 id="inventory-item-title" className="text-lg font-semibold">{editing ? 'Edit item' : 'Add inventory item'}</h3>
              <p className="text-muted-foreground mt-1 text-sm">The QR code will always use the current name, description, and point cost.</p>
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
            {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <NeoButton type="button" variant="surface" disabled={saveItem.isPending} onClick={() => setEditing(undefined)}>Cancel</NeoButton>
              <NeoButton type="button" variant="primary" disabled={saveItem.isPending} onClick={() => void submit()}>{saveItem.isPending ? 'Saving…' : 'Save item'}</NeoButton>
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
}
