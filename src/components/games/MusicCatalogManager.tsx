import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { MusicCatalogUploader } from '@/components/games/MusicCatalogUploader'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  useDeleteMusicCatalog,
  useMusicCatalog,
  useUpdateMusicCatalog,
  type MusicCatalogRow,
} from '@/hooks/use-music-catalog'

/**
 * #23: org-wide Music Catalog manager — bulk upload (30s clips), edit, and bulk
 * delete. The single source of truth for music; bingo games pick from here.
 */
export function MusicCatalogManager({ organizationId }: { organizationId: string }) {
  const catalogQuery = useMusicCatalog(organizationId)
  const deleteCatalog = useDeleteMusicCatalog(organizationId)
  const updateCatalog = useUpdateMusicCatalog(organizationId)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MusicCatalogRow | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')

  const rows = catalogQuery.data ?? []
  const selectedRows = rows.filter((r) => selected.has(r.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    )
  }

  async function confirmBulkDelete() {
    setError(null)
    try {
      for (const row of selectedRows) await deleteCatalog.mutateAsync(row)
      setSelected(new Set())
      setBulkDeleteOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tracks')
    }
  }

  function startEdit(row: MusicCatalogRow) {
    setEditing(row)
    setEditTitle(row.title)
    setEditArtist(row.artist)
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    try {
      await updateCatalog.mutateAsync({ id: editing.id, title: editTitle, artist: editArtist })
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save track')
    }
  }

  return (
    <div className="space-y-6">
      <MusicCatalogUploader
        organizationId={organizationId}
        clipLengthSeconds={30}
        onTracksReady={() => {
          /* manager view — uploads land in the catalog, not a specific game */
        }}
      />

      {error ? <QueryError message={error} /> : null}

      {catalogQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : catalogQuery.isError ? (
        <QueryError message={catalogQuery.error?.message ?? 'Could not load catalog'} />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No tracks yet. Upload MP3s above — clips are generated automatically.
        </p>
      ) : (
        <Card className="border-border/80 space-y-3 bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={rows.length > 0 && selected.size === rows.length}
                ref={(el) => {
                  if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length
                }}
                onChange={toggleAll}
              />
              Select all ({rows.length})
            </label>
            {selected.size > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deleteCatalog.isPending}
                onClick={() => {
                  setError(null)
                  setBulkDeleteOpen(true)
                }}
              >
                Delete {selected.size} selected
              </Button>
            ) : null}
          </div>
          <ul className="divide-border/50 divide-y text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                />
                <span className="min-w-0 flex-1 truncate">
                  {row.title} — {row.artist}
                  {!row.clip_url ? <span className="text-amber-600"> · clip pending</span> : null}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteCatalog.isPending}
                  onClick={() => void deleteCatalog.mutateAsync(row).catch((e) => setError(String(e)))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 w-full max-w-sm space-y-4 bg-card p-6 shadow-lg">
            <h3 className="text-foreground font-semibold">Edit track</h3>
            <div className="space-y-2">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
              <Input value={editArtist} onChange={(e) => setEditArtist(e.target.value)} placeholder="Artist" />
            </div>
            <div className="flex justify-end gap-2">
              <NeoButton variant="surface" onClick={() => setEditing(null)}>
                Cancel
              </NeoButton>
              <NeoButton variant="primary" disabled={updateCatalog.isPending} onClick={() => void saveEdit()}>
                {updateCatalog.isPending ? 'Saving…' : 'Save'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}

      {bulkDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <h3 className="text-foreground font-semibold">
              Delete {selectedRows.length} track{selectedRows.length === 1 ? '' : 's'}?
            </h3>
            <p className="text-muted-foreground text-sm">
              Their audio and clip files are removed from storage. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton variant="surface" disabled={deleteCatalog.isPending} onClick={() => setBulkDeleteOpen(false)}>
                Cancel
              </NeoButton>
              <NeoButton variant="destructive" disabled={deleteCatalog.isPending} onClick={() => void confirmBulkDelete()}>
                {deleteCatalog.isPending ? 'Deleting…' : `Delete ${selectedRows.length}`}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
