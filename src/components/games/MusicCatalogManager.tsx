import { Music2, Pencil, Play, SkipBack, SkipForward, Trash2, X } from 'lucide-react'
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

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const rounded = Math.max(0, Math.round(seconds))
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function formatAddedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

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
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)

  const allRows = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data])
  const playlists = useMemo(() => playlistsQuery.data ?? [], [playlistsQuery.data])
  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data])

  // playlist_id -> Set(track_id)
  const tracksByPlaylist = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const m of memberships) {
      if (!map.has(m.playlist_id)) map.set(m.playlist_id, new Set())
      map.get(m.playlist_id)!.add(m.track_id)
    }
    return map
  }, [memberships])
  const playlistNamesByTrack = useMemo(() => {
    const names = new Map<string, string[]>()
    const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist.name]))
    for (const membership of memberships) {
      const playlistName = playlistById.get(membership.playlist_id)
      if (!playlistName) continue
      const current = names.get(membership.track_id) ?? []
      current.push(playlistName)
      names.set(membership.track_id, current)
    }
    return names
  }, [memberships, playlists])

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
  const playingTrack = allRows.find((row) => row.id === playingTrackId) ?? null

  // Transport steps through the list as currently filtered and sorted, which
  // is what the organiser can actually see, rather than the whole library.
  const playingIndex = rows.findIndex((row) => row.id === playingTrackId)
  const hasPrev = playingIndex > 0
  const hasNext = playingIndex >= 0 && playingIndex < rows.length - 1

  function stepTrack(delta: number) {
    if (playingIndex < 0) return
    const next = rows[playingIndex + delta]
    if (next) setPlayingTrackId(next.id)
  }

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

      <div className="border-nm-slate-800 bg-card min-h-[35rem] overflow-hidden rounded-lg border-2 lg:grid lg:grid-cols-[150px_minmax(0,1fr)_130px]">
      {/* Playlist rail */}
      <aside className="border-border bg-card flex flex-col border-b p-3 lg:min-h-[34rem] lg:border-b-0 lg:border-r">
        <div className="mb-3">
          <h3 className="text-foreground text-sm font-bold">My Playlists</h3>
          <div className="bg-primary mt-1 h-0.5 w-8" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => setActivePlaylist(null)}
          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors ${
            activePlaylist === null
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <span>All tracks</span><span>{allRows.length}</span>
        </button>
        {playlists.map((pl) => (
          <span
            key={pl.id}
            className={`flex w-full items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
              activePlaylist === pl.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <span className="bg-nm-slate-400 size-2.5 shrink-0 rounded-sm" />
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setActivePlaylist(pl.id)}>
              {pl.name}
            </button>
            <span className="text-[10px]">{tracksByPlaylist.get(pl.id)?.size ?? 0}</span>
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
        </div>
        <span className="mt-3 flex items-center gap-1">
          <Input
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist"
            className="h-8 min-w-0 flex-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreatePlaylist()
            }}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            disabled={!newPlaylistName.trim() || createPlaylist.isPending}
            onClick={() => void handleCreatePlaylist()}
            aria-label="Add playlist"
          >
            +
          </Button>
        </span>
      </aside>

      <div className="min-w-0 p-4">

      <div className="bg-nm-slate-900 text-white mb-4 flex flex-col gap-3 rounded-lg px-4 py-3 sm:flex-row sm:items-center">
        <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
          <Music2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-white/55 uppercase">Preview player</p>
          <p className="truncate text-sm font-semibold">
            {playingTrack ? playingTrack.title : 'Choose a track to preview'}
          </p>
          {playingTrack ? <p className="truncate text-xs text-white/60">{playingTrack.artist}</p> : null}
        </div>
        {playingTrack ? (
          <div className="flex w-full max-w-md items-center gap-2">
            <button
              type="button"
              aria-label="Previous track"
              disabled={!hasPrev}
              onClick={() => stepTrack(-1)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <SkipBack className="size-4" />
            </button>
            <audio
              key={playingTrack.id}
              src={playingTrack.clip_url ?? playingTrack.audio_url}
              controls
              autoPlay
              preload="metadata"
              // Rolling straight into the next track matches how the organiser
              // auditions a playlist, and mirrors the design's transport bar.
              onEnded={() => stepTrack(1)}
              className="h-8 min-w-0 flex-1"
              aria-label={`Preview ${playingTrack.title} by ${playingTrack.artist}`}
            />
            <button
              type="button"
              aria-label="Next track"
              disabled={!hasNext}
              onClick={() => stepTrack(1)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <SkipForward className="size-4" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/55">Use the play button beside any song.</p>
        )}
      </div>

      {/* Search + sort */}
      <div className="border-border mb-3 flex flex-wrap items-center gap-2 border-b pb-3">
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
        <div className="space-y-3">
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
          <div className="text-muted-foreground hidden grid-cols-[28px_minmax(180px,1fr)_minmax(120px,0.7fr)_90px_65px_80px] gap-3 border-b pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] xl:grid">
            <span /> <span>Title / Artist</span> <span>Playlists</span> <span>Added</span><span>Duration</span> <span className="text-right">Actions</span>
          </div>
          <ul className="divide-border/50 divide-y text-sm">
            {rows.map((row) => (
              <li key={row.id} className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 xl:grid-cols-[28px_minmax(180px,1fr)_minmax(120px,0.7fr)_90px_65px_80px] ${playingTrackId === row.id ? 'bg-primary/5' : ''}`}>
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                />
                <button
                  type="button"
                  className="group min-w-0 text-left"
                  onClick={() => setPlayingTrackId(row.id)}
                  aria-label={`Preview ${row.title} by ${row.artist}`}
                >
                  <span className="text-foreground flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold">
                    <Play className="text-primary size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" fill="currentColor" />
                    <span className="truncate">{row.title}</span>
                  </span>
                  <span className="text-muted-foreground block truncate pl-[18px] text-[11px]">{row.artist}</span>
                  {!row.clip_url ? <span className="text-amber-600"> · clip pending</span> : null}
                </button>
                <span className="text-muted-foreground hidden truncate text-xs xl:block">
                  {playlistNamesByTrack.get(row.id)?.join(', ') || '—'}
                </span>
                <span className="text-muted-foreground hidden text-xs xl:block">{formatAddedDate(row.created_at)}</span>
                <span className="text-muted-foreground hidden text-xs tabular-nums xl:block">{formatDuration(row.duration_seconds)}</span>
                <span className="flex justify-end">
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => startEdit(row)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteCatalog.isPending}
                  onClick={() => void deleteCatalog.mutateAsync(row).catch((e) => setError(String(e)))}
                >
                  <Trash2 className="size-4" />
                </Button>
                </span>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="text-muted-foreground py-3 text-sm">No tracks match.</li>
            ) : null}
          </ul>
        </div>
      )}
      </div>
      <aside className="bg-nm-slate-800 hidden min-h-[35rem] flex-col lg:flex">
        <div className="bg-primary text-primary-foreground flex flex-1 items-center justify-center px-3 text-center text-[11px] font-bold tracking-[0.08em] uppercase">
          Album Cover
        </div>
        <p className="px-3 py-3 text-center text-xs font-bold text-white">
          {activePlaylist ? playlists.find((playlist) => playlist.id === activePlaylist)?.name : 'Full Library'}
        </p>
      </aside>
      </div>

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
