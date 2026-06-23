import { Pencil, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import {
  useAddTracksToPlaylist,
  useCreatePlaylist,
  useDeletePlaylist,
  useMusicPlaylists,
  usePlaylistMemberships,
} from '@/hooks/use-music-playlists'

type SortBy = 'title' | 'date' | 'genre'

/**
 * Org-wide Music Catalog manager — bulk upload (30s clips), edit (incl. optional
 * genre), search, sort, playlists (many-to-many), and bulk delete. The single
 * source of truth for music; bingo games pick from here.
 */
export function MusicCatalogManager({ organizationId }: { organizationId: string }) {
  const catalogQuery = useMusicCatalog(organizationId)
  const deleteCatalog = useDeleteMusicCatalog(organizationId)
  const updateCatalog = useUpdateMusicCatalog(organizationId)

  const playlistsQuery = useMusicPlaylists(organizationId)
  const membershipsQuery = usePlaylistMemberships(organizationId)
  const createPlaylist = useCreatePlaylist(organizationId)
  const deletePlaylist = useDeletePlaylist(organizationId)
  const addToPlaylist = useAddTracksToPlaylist(organizationId)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MusicCatalogRow | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editGenre, setEditGenre] = useState('')

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const allRows = catalogQuery.data ?? []
  const playlists = playlistsQuery.data ?? []
  const memberships = membershipsQuery.data ?? []

  // playlist_id -> Set(track_id)
  const tracksByPlaylist = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const m of memberships) {
      if (!map.has(m.playlist_id)) map.set(m.playlist_id, new Set())
      map.get(m.playlist_id)!.add(m.track_id)
    }
    return map
  }, [memberships])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = allRows
    if (activePlaylist) {
      const ids = tracksByPlaylist.get(activePlaylist) ?? new Set<string>()
      list = list.filter((r) => ids.has(r.id))
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.artist.toLowerCase().includes(q) ||
          (r.genre ?? '').toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    if (sortBy === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'genre') {
      sorted.sort((a, b) => (a.genre ?? '').localeCompare(b.genre ?? '') || a.title.localeCompare(b.title))
    } else {
      sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    }
    return sorted
  }, [allRows, activePlaylist, tracksByPlaylist, search, sortBy])

  const selectedRows = allRows.filter((r) => selected.has(r.id))

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
    setEditGenre(row.genre ?? '')
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    try {
      await updateCatalog.mutateAsync({
        id: editing.id,
        title: editTitle,
        artist: editArtist,
        genre: editGenre,
      })
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save track')
    }
  }

  async function handleCreatePlaylist() {
    const name = newPlaylistName.trim()
    if (!name) return
    setError(null)
    try {
      await createPlaylist.mutateAsync(name)
      setNewPlaylistName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create playlist')
    }
  }

  async function handleAddToPlaylist(playlistId: string) {
    setError(null)
    try {
      await addToPlaylist.mutateAsync({ playlistId, trackIds: [...selected] })
      setAddMenuOpen(false)
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to playlist')
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

      {/* Playlists bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActivePlaylist(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            activePlaylist === null
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/80 text-muted-foreground hover:bg-muted/40'
          }`}
        >
          All ({allRows.length})
        </button>
        {playlists.map((pl) => (
          <span
            key={pl.id}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
              activePlaylist === pl.id
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border/80 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            <button type="button" onClick={() => setActivePlaylist(pl.id)}>
              {pl.name} ({tracksByPlaylist.get(pl.id)?.size ?? 0})
            </button>
            <button
              type="button"
              aria-label={`Delete playlist ${pl.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (activePlaylist === pl.id) setActivePlaylist(null)
                void deletePlaylist.mutateAsync(pl.id).catch((e) => setError(String(e)))
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1">
          <Input
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist"
            className="h-8 w-36 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreatePlaylist()
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!newPlaylistName.trim() || createPlaylist.isPending}
            onClick={() => void handleCreatePlaylist()}
          >
            Add
          </Button>
        </span>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, artist or genre…"
          className="h-9 max-w-xs flex-1"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="date">Newest first</option>
          <option value="title">Title A–Z</option>
          <option value="genre">Genre</option>
        </select>
      </div>

      {catalogQuery.isLoading ? (
        <QueryLoading rows={4} />
      ) : catalogQuery.isError ? (
        <QueryError message={catalogQuery.error?.message ?? 'Could not load catalog'} />
      ) : allRows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No tracks yet. Upload MP3s above — clips are generated automatically.
        </p>
      ) : (
        <Card className="border-border/80 space-y-3 bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                ref={(el) => {
                  if (el)
                    el.indeterminate =
                      selected.size > 0 && !rows.every((r) => selected.has(r.id))
                }}
                onChange={toggleAll}
              />
              Select all ({rows.length})
            </label>
            {selected.size > 0 ? (
              <>
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={playlists.length === 0 || addToPlaylist.isPending}
                    onClick={() => setAddMenuOpen((o) => !o)}
                  >
                    Add {selected.size} to playlist
                  </Button>
                  {addMenuOpen ? (
                    <div className="border-border/80 bg-card absolute z-10 mt-1 w-48 rounded-md border p-1 shadow-lg">
                      {playlists.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          className="hover:bg-muted/50 block w-full rounded px-2 py-1.5 text-left text-sm"
                          onClick={() => void handleAddToPlaylist(pl.id)}
                        >
                          {pl.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
              </>
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
                  {row.genre ? (
                    <span className="text-muted-foreground"> · {row.genre}</span>
                  ) : null}
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
            {rows.length === 0 ? (
              <li className="text-muted-foreground py-3 text-sm">No tracks match.</li>
            ) : null}
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
              <Input
                value={editGenre}
                onChange={(e) => setEditGenre(e.target.value)}
                placeholder="Genre (optional)"
              />
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
