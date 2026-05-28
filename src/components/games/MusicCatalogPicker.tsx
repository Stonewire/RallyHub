import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { useMusicCatalog } from '@/hooks/use-music-catalog'
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

  const available = useMemo(() => {
    if (!catalogQuery.data) return []
    return catalogQuery.data.filter((row) => !existingTrackIds.has(row.id))
  }, [catalogQuery.data, existingTrackIds])

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

  if (available.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        All catalog tracks are already on this game.
      </p>
    )
  }

  return (
    <Card className="border-border/80 space-y-3 bg-muted/20 p-4">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Organization catalog</h3>
        <p className="text-muted-foreground text-xs">
          Reuse tracks uploaded for other bingo games ({available.length} available).
        </p>
      </div>
      <ul className="max-h-48 space-y-1 overflow-auto text-sm">
        {available.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 py-1">
            <span className="truncate">
              {row.title} — {row.artist}
              {!row.clip_url ? (
                <span className="text-amber-600"> · clip pending</span>
              ) : null}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
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
          </li>
        ))}
      </ul>
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
        Add all {available.length} tracks
      </Button>
    </Card>
  )
}
