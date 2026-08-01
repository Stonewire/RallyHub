import {
  Check,
  Copy,
  Download,
  ImagePlus,
  PackageOpen,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton, NeoInput, NeoLabel, NeoTextarea } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
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

export type InventoryLibraryHandle = {
  openCreate: () => void
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
  const [search, setSearch] = useState('')
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
    exportAll: () => void exportPdf(items),
    canExport: items.length > 0 && !exporting,
  }))

  if (itemsQuery.isLoading) return <QueryLoading rows={6} />
  if (itemsQuery.isError) return <QueryError message={itemsQuery.error.message} />

  return (
    <div className={editing !== undefined ? "space-y-5 xl:pr-[36rem]" : "space-y-5"}>
      {message ? (
        <div className="border-border bg-card flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)}><X className="size-4" /></button>
        </div>
      ) : null}
      {error && editing === undefined && !pendingDelete ? (
        <p className="text-destructive text-sm" role="alert">{error}</p>
      ) : null}

      {/* Same shape as the Games Library toolbar: one h-9 search, nothing else. */}
      <div className="border-border/70 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <NeoInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search inventory…"
            className="h-9 pl-9 text-xs"
          />
        </div>
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
                      <PackageOpen className="size-7" />
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
                      <Copy className="size-3.5" />
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
                      <Download className="size-3.5" />
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
                      <Pencil className="size-3.5" />
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
                      <Trash2 className="size-3.5" />
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
                <X className="size-4" />
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
                    <Download className="size-4" />
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
