import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDeleteMusicCatalog, useMusicCatalog, type MusicCatalogRow } from '@/hooks/use-music-catalog'
import type { MusicTrack } from '@/types/game-config'

type MusicCatalogPickerProps = {
  organizationId: string
  existingTrackIds: Set<string>
  onAdd: (tracks: MusicTrack[]) => void
}

export function MusicCatalogPicker({
  organizationId,
  existingTrackIds,
  onAdd,
}: MusicCatalogPickerProps) {
  const catalogQuery = useMusicCatalog(organizationId)
  const deleteCatalog = useDeleteMusicCatalog(organizationId)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MusicCatalogRow | null>(null)

  const available = useMemo(() => {
    if (!catalogQuery.data) return []
    return catalogQuery.data.filter((row) => !existingTrackIds.has(row.id))
  }, [catalogQuery.data, existingTrackIds])

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await deleteCatalog.mutateAsync(pendingDelete)
      setPendingDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete track')
    }
  }

  if (catalogQuery.isLoading) return <QueryLoading rows={2} />
  if (catalogQuery.isError) {
    return <QueryError message={catalogQuery.error?.message ?? 'Could not load catalog'} />
  }

  if (!catalogQuery.data?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No tracks in your organization catalog yet. Upload MP3s below to add them.
      </p>
    )
  }

  return (
    <Card className="border-border/80 space-y-3 bg-muted/20 p-4">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Organization catalog</h3>
        <p className="text-muted-foreground text-xs">
          Reuse or remove tracks uploaded for your bingo games ({catalogQuery.data.length}{' '}
          total{catalogQuery.data.length !== available.length
            ? ` · ${available.length} not on this game`
            : ''}
          ).
        </p>
      </div>
      <ul className="max-h-56 space-y-1 overflow-auto text-sm">
        {catalogQuery.data.map((row) => {
          const onGame = existingTrackIds.has(row.id)
          return (
            <li key={row.id} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0 truncate">
                {row.title} — {row.artist}
                {!row.clip_url ? (
                  <span className="text-amber-600"> · clip pending</span>
                ) : onGame ? (
                  <span className="text-muted-foreground"> · on this game</span>
                ) : null}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {!onGame ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onAdd([
                        {
                          id: row.id,
                          title: row.title,
                          artist: row.artist,
                          audioUrl: row.audio_url,
                          clipUrl: row.clip_url ?? undefined,
                          clipStartSeconds: Number(row.clip_start_seconds) || 0,
                          clipDurationSeconds: row.clip_duration_seconds ?? 30,
                        },
                      ])
                    }
                  >
                    Add
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteCatalog.isPending}
                  aria-label={`Delete ${row.title}`}
                  onClick={() => {
                    setDeleteError(null)
                    setPendingDelete(row)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {available.length > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            onAdd(
              available.map((row) => ({
                id: row.id,
                title: row.title,
                artist: row.artist,
                audioUrl: row.audio_url,
                clipUrl: row.clip_url ?? undefined,
                clipStartSeconds: Number(row.clip_start_seconds) || 0,
                clipDurationSeconds: row.clip_duration_seconds ?? 30,
              })),
            )
          }
        >
          Add all {available.length} available tracks
        </Button>
      ) : null}
      {deleteError ? (
        <p className="text-destructive text-sm" role="alert">
          {deleteError}
        </p>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="catalog-delete-title"
          aria-describedby="catalog-delete-message"
        >
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-lg">
            <div className="space-y-2">
              <h3 id="catalog-delete-title" className="text-foreground font-semibold">
                Delete catalog track?
              </h3>
              <p id="catalog-delete-message" className="text-muted-foreground text-sm leading-relaxed">
                Delete{' '}
                <span className="text-foreground font-medium">
                  {pendingDelete.title} — {pendingDelete.artist}
                </span>{' '}
                from your organization catalog? The full audio and clip files will be removed. This
                cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <NeoButton
                type="button"
                variant="surface"
                disabled={deleteCatalog.isPending}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="destructive"
                disabled={deleteCatalog.isPending}
                onClick={() => void confirmDelete()}
              >
                {deleteCatalog.isPending ? 'Deleting…' : 'Delete track'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </Card>
  )
}
