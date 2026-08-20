import { IconMusic, IconPause, IconPlay, IconTrash } from '@/components/icons'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { useMusicCatalog, type MusicCatalogRow } from '@/hooks/use-music-catalog'
import { useMusicPlaylists, usePlaylistMemberships } from '@/hooks/use-music-playlists'
import { useClipJobs } from '@/lib/bingo-clip-jobs'
import { cn } from '@/lib/utils'
import type { MusicTrack } from '@/types/game-config'

type BingoTrackPickerProps = {
  organizationId: string
  /** Tracks currently on the game. */
  gameTracks: MusicTrack[]
  clipLength: number
  onAdd: (tracks: MusicTrack[]) => void
  onRemove: (trackIds: string[]) => void
}

function catalogRowToTrack(row: MusicCatalogRow): MusicTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    audioUrl: row.audio_url,
    clipUrl: row.clip_url ?? undefined,
    clipStartSeconds: Number(row.clip_start_seconds) || 0,
    clipDurationSeconds: row.clip_duration_seconds ?? 30,
    clipInPointSeconds:
      row.clip_in_point_seconds == null ? null : Number(row.clip_in_point_seconds),
  }
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const rounded = Math.max(0, Math.round(seconds))
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function StatusTag({ tone, children }: { tone: 'ready' | 'pending'; children: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase',
        tone === 'ready'
          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          : 'bg-nm-yellow/40 text-nm-charcoal dark:text-nm-yellow',
      )}
    >
      {children}
    </span>
  )
}

function formatAddedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

/**
 * The bingo track card: pick a playlist, audition it, and move songs onto the
 * game. Same columns as the Music Library so the two read as one system.
 *
 * Everything a row can be is visible at once — on the game, being cut, ready —
 * because an organiser building a game cares about the gap between "added" and
 * "playable", and that gap is the clip.
 */
export function BingoTrackPicker({
  organizationId,
  gameTracks,
  clipLength,
  onAdd,
  onRemove,
}: BingoTrackPickerProps) {
  const { t } = useTranslation('admin')
  const catalogQuery = useMusicCatalog(organizationId)
  const playlistsQuery = useMusicPlaylists(organizationId)
  const membershipsQuery = usePlaylistMemberships(organizationId)
  const jobs = useClipJobs()

  const [playlistId, setPlaylistId] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const allRows = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data])
  const playlists = useMemo(() => playlistsQuery.data ?? [], [playlistsQuery.data])
  const memberships = useMemo(() => membershipsQuery.data ?? [], [membershipsQuery.data])

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
    const byId = new Map(playlists.map((p) => [p.id, p.name]))
    for (const m of memberships) {
      const name = byId.get(m.playlist_id)
      if (!name) continue
      names.set(m.track_id, [...(names.get(m.track_id) ?? []), name])
    }
    return names
  }, [memberships, playlists])

  const gameTrackById = useMemo(
    () => new Map(gameTracks.map((t) => [t.id, t])),
    [gameTracks],
  )

  const rows = useMemo(() => {
    if (playlistId === 'all') return allRows
    const ids = tracksByPlaylist.get(playlistId) ?? new Set<string>()
    return allRows.filter((r) => ids.has(r.id))
  }, [allRows, playlistId, tracksByPlaylist])

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const selectedToAdd = selectedRows.filter((r) => !gameTrackById.has(r.id))
  const selectedOnGame = selectedRows.filter((r) => gameTrackById.has(r.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))

  /** Plays what the game would play: its own clip, or the full song if none. */
  function sourceFor(row: MusicCatalogRow): string | undefined {
    const onGame = gameTrackById.get(row.id)
    return onGame?.clipUrl ?? row.clip_url ?? row.audio_url ?? undefined
  }

  const playingRow = rows.find((r) => r.id === playingId) ?? null
  const playingIndex = rows.findIndex((r) => r.id === playingId)

  function playRow(row: MusicCatalogRow) {
    if (playingId === row.id) {
      const audio = audioRef.current
      if (!audio) return
      if (audio.paused) void audio.play()
      else audio.pause()
      return
    }
    setPlayingId(row.id)
  }

  if (catalogQuery.isLoading) return <QueryLoading rows={4} />
  if (catalogQuery.isError) {
    return (
      <QueryError
        message={catalogQuery.error?.message ?? t('games.music.loadLibraryError')}
      />
    )
  }

  return (
    <Card className="border-border/80 overflow-hidden bg-card p-0 shadow-sm">
      <div className="border-border flex flex-wrap items-center gap-2 border-b p-3">
        <select
          aria-label={t('games.music.selectPlaylist')}
          value={playlistId}
          onChange={(e) => {
            setPlaylistId(e.target.value)
            setSelected(new Set())
          }}
          className="bg-nm-yellow text-nm-charcoal h-8 rounded-md px-2.5 text-xs font-semibold"
        >
          <option value="all">{t('games.music.allTracksCount', { count: allRows.length })}</option>
          {playlists.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.name} ({tracksByPlaylist.get(pl.id)?.size ?? 0})
            </option>
          ))}
        </select>

        <span className="text-muted-foreground text-xs">
          {t('games.bingo.onThisGame', { count: gameTracks.length })}
          {selected.size > 0 ? ` · ${t('games.selectedCount', { count: selected.size })}` : ''}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <NeoButton
            type="button"
            variant="surface"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => {
              if (playingRow) {
                playRow(playingRow)
                return
              }
              setPlayingId(rows[0]?.id ?? null)
            }}
          >
            {isPlaying ? <IconPause className="size-3.5" /> : <IconPlay className="size-3.5" />}
            {isPlaying ? t('games.music.pause') : t('games.music.playPlaylist')}
          </NeoButton>
          <NeoButton
            type="button"
            variant="surface"
            size="sm"
            disabled={rows.length === 0}
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
            }
          >
            {allSelected
              ? t('games.clearSelection')
              : t('games.selectAllCount', { count: rows.length })}
          </NeoButton>
          {selectedOnGame.length > 0 ? (
            <NeoButton
              type="button"
              variant="surface"
              size="sm"
              className="text-destructive"
              onClick={() => {
                onRemove(selectedOnGame.map((r) => r.id))
                setSelected(new Set())
              }}
            >
              <IconTrash className="size-3.5" />
              {t('games.removeCount', { count: selectedOnGame.length })}
            </NeoButton>
          ) : null}
          <NeoButton
            type="button"
            variant="accent"
            size="sm"
            disabled={selectedToAdd.length === 0 || jobs.running}
            onClick={() => {
              onAdd(selectedToAdd.map(catalogRowToTrack))
              setSelected(new Set())
            }}
          >
            {selectedToAdd.length
              ? t('games.bingo.addCountToBingo', { count: selectedToAdd.length })
              : t('games.bingo.addToBingo')}
          </NeoButton>
        </div>
      </div>

      {jobs.error ? (
        <p className="text-destructive px-3 pt-3 text-sm" role="alert">
          {jobs.error}
        </p>
      ) : null}

      <div className="p-3">
        <div className="text-muted-foreground hidden grid-cols-[28px_minmax(160px,1fr)_84px_minmax(110px,0.7fr)_90px_70px_60px] gap-3 border-b pb-2 text-[10px] font-semibold tracking-[0.08em] uppercase xl:grid">
          <span />
          <span>{t('games.music.colTitleArtist')}</span>
          <span>{t('games.music.colStatus')}</span>
          <span>{t('games.music.colPlaylists')}</span>
          <span>{t('games.music.colAdded')}</span>
          <span>{t('games.music.colDuration')}</span>
          <span className="text-right">{t('games.music.colActions')}</span>
        </div>

        <ul className="divide-border/50 divide-y text-sm">
          {rows.map((row) => {
            const onGame = gameTrackById.get(row.id) ?? null
            const progress = jobs.progress[row.id]
            const cutting = progress !== undefined
            return (
              <li
                key={row.id}
                className={cn(
                  'relative grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 px-1 py-2.5 xl:grid-cols-[28px_minmax(160px,1fr)_84px_minmax(110px,0.7fr)_90px_70px_60px]',
                  playingId === row.id ? 'bg-primary/5' : '',
                  // Queued and cutting tracks are amber; the green fill crosses
                  // the row as each real step of the cut completes.
                  cutting ? 'bg-nm-yellow/25' : '',
                )}
              >
                {cutting ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-emerald-500/30 transition-[width] duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                ) : null}

                <input
                  type="checkbox"
                  className="relative shrink-0"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={t('games.music.selectTrack', { title: row.title })}
                />

                <button
                  type="button"
                  className="group relative min-w-0 text-left"
                  onClick={() => playRow(row)}
                  aria-label={t('games.music.playTrack', { title: row.title, artist: row.artist })}
                >
                  <span className="text-foreground flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                    {playingId === row.id && isPlaying ? (
                      <IconPause className="text-primary size-3.5 shrink-0" />
                    ) : (
                      <IconPlay
                        className="text-primary size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        fill="currentColor"
                      />
                    )}
                    <span className="truncate">{row.title}</span>
                  </span>
                  <span className="text-muted-foreground block truncate pl-[18px] text-[11px]">
                    {row.artist}
                  </span>
                </button>

                {/* Status is its own column so a long title never pushes the
                    badge onto a second line. Green means on the game with a
                    clip at this length, so it is ready to play. */}
                <span className="relative">
                  {cutting ? (
                    <StatusTag tone="pending">{t('games.bingo.statusCutting')}</StatusTag>
                  ) : !onGame ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : onGame.clipUrl && onGame.clipDurationSeconds === clipLength ? (
                    <StatusTag tone="ready">{t('games.bingo.statusReady')}</StatusTag>
                  ) : (
                    <StatusTag tone="pending">{t('games.bingo.statusNoClip')}</StatusTag>
                  )}
                </span>

                <span className="text-muted-foreground relative hidden truncate text-xs xl:block">
                  {playlistNamesByTrack.get(row.id)?.join(', ') || '—'}
                </span>
                <span className="text-muted-foreground relative hidden text-xs xl:block">
                  {formatAddedDate(row.created_at)}
                </span>
                <span className="text-muted-foreground relative hidden text-xs tabular-nums xl:block">
                  {onGame
                    ? formatDuration(onGame.clipDurationSeconds ?? clipLength)
                    : formatDuration(row.duration_seconds)}
                </span>

                <span className="relative flex justify-end">
                  {onGame ? (
                    <button
                      type="button"
                      aria-label={t('games.bingo.removeTrackFromGame', { title: row.title })}
                      className="text-muted-foreground hover:text-destructive flex size-7 items-center justify-center rounded-md"
                      onClick={() => onRemove([row.id])}
                    >
                      <IconTrash className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t('games.bingo.addTrackToGame', { title: row.title })}
                      className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md"
                      disabled={jobs.running}
                      onClick={() => onAdd([catalogRowToTrack(row)])}
                    >
                      <IconMusic className="size-4" />
                    </button>
                  )}
                </span>
              </li>
            )
          })}
          {rows.length === 0 ? (
            <li className="text-muted-foreground py-4 text-sm">
              {allRows.length === 0
                ? t('games.bingo.noMusicYet')
                : t('games.music.playlistEmpty')}
            </li>
          ) : null}
        </ul>

        <p className="text-muted-foreground mt-3 text-xs">
          {t('games.bingo.playbackNote', { seconds: clipLength })}
        </p>
      </div>

      <audio
        ref={audioRef}
        key={playingId ?? 'none'}
        src={playingRow ? sourceFor(playingRow) : undefined}
        autoPlay
        preload="metadata"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          const next = rows[playingIndex + 1]
          if (next) setPlayingId(next.id)
          else {
            setPlayingId(null)
            setIsPlaying(false)
          }
        }}
      />
    </Card>
  )
}
