import { IconPlus, IconRefresh } from '@/components/icons'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { AssetField } from '@/components/games/AssetField'
import { BingoWinningComboEditor } from '@/components/games/BingoWinningComboEditor'
import { MusicCatalogPicker } from '@/components/games/MusicCatalogPicker'
import { Button } from '@/components/ui/button'
import { BackgroundDesigner } from '@/components/games/BackgroundDesigner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { extractAudioClip } from '@/lib/extract-audio-clip'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import {
  BINGO_CLIP_LENGTHS,
  bingoClipLength,
  downloadUrl,
  ensureMusicTrackClip,
  parseBingoClipLength,
  type BingoClipLength,
} from '@/lib/music-track-clips'
import { NeoButton, SegmentedPill } from '@/components/neo-minimal'
import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { uploadAsset } from '@/lib/storage'
import { audioStorageFilename } from '@/lib/storage-path'
import type { GameConfig, MusicTrack } from '@/types/game-config'

type MusicBingoEditorProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  organizationId: string
  coverUrl: string | null
  setCoverUrl: (v: string | null) => void
  /** Shown in the Background Designer's live preview. */
  gameName?: string
  section?: 'settings' | 'designer' | 'tracks'
}

export function MusicBingoEditor({
  config,
  setConfig,
  organizationId,
  coverUrl,
  setCoverUrl,
  gameName = '',
  section = 'tracks',
}: MusicBingoEditorProps) {
  const tracks = useMemo(() => config.tracks ?? [], [config.tracks])
  const [clipProgress, setClipProgress] = useState<{ done: number; total: number } | null>(null)
  const [clipError, setClipError] = useState<string | null>(null)
  const existingTrackIds = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks])
  const clipLen = bingoClipLength(config)
  const clipBusy = clipProgress !== null
  // Clips are per game, so a track carrying a clip at a different length counts
  // as stale and has to be cut again.
  const staleClips = tracks.filter(
    (t) =>
      t.audioUrl?.trim() &&
      (!t.clipUrl?.trim() || t.clipDurationSeconds !== clipLen),
  )

  /** Cuts clips one at a time, saving each as it lands so a failure keeps the rest. */
  async function generateClips(list: MusicTrack[], length: BingoClipLength) {
    if (list.length === 0) return
    setClipError(null)
    setClipProgress({ done: 0, total: list.length })
    try {
      for (const [index, track] of list.entries()) {
        const next = await ensureMusicTrackClip(track, organizationId, length)
        setConfig((c) => ({
          ...c,
          tracks: (c.tracks ?? []).map((t) => (t.id === next.id ? next : t)),
        }))
        setClipProgress({ done: index + 1, total: list.length })
      }
    } catch (err) {
      setClipError(err instanceof Error ? err.message : 'Clip generation failed')
    } finally {
      setClipProgress(null)
    }
  }

  async function uploadTrackAudio(trackId: string, file: File, withClip: boolean) {
    const audioUrl = await uploadGameFile(organizationId, `bingo/audio-${trackId}`, file)
    let patch: Partial<MusicTrack> = { audioUrl, clipUrl: null }
    if (withClip && clipLen) {
      const duration = await readAudioDuration(file).catch(() => 0)
      const clipStart = suggestClipStart(duration)
      const extracted = await extractAudioClip(file, clipLen, clipStart)
      const clipFilename = audioStorageFilename(`clip-${clipLen}s-${file.name}`, extracted.extension)
      const clipFile = new File([extracted.blob], clipFilename, { type: extracted.mimeType })
      const clipUrl = await uploadAsset(
        'game-assets',
        `${organizationId}/catalog/${crypto.randomUUID()}-${clipFilename}`,
        clipFile,
      )
      patch = {
        audioUrl,
        clipUrl,
        clipStartSeconds: clipStart,
        clipDurationSeconds: clipLen,
      }
    }
    setConfig((c) => ({
      ...c,
      tracks: (c.tracks ?? []).map((tr) => (tr.id === trackId ? { ...tr, ...patch } : tr)),
    }))
  }


  // 'settings' fills Primary settings, 'designer' the right-hand card, and
  // 'tracks' the full-width area below, matching the other game types.
  if (section === 'settings') {
    return (
      <>
        <AssetField
          label="Cover image"
          onFile={async (f) => {
            if (!f) return
            setCoverUrl(await uploadGameFile(organizationId, `bingo/cover-${newGameId()}`, f))
          }}
          onUrl={setCoverUrl}
          preview={coverUrl}
          showPreviewPanel
        />
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="shrink-0">Clip length</Label>
            <SegmentedPill
              size="sm"
              className="min-w-32 flex-1"
              aria-label="Clip length"
              options={BINGO_CLIP_LENGTHS.map((len) => ({
                value: String(len),
                label: `${len}s`,
              }))}
              value={String(clipLen)}
              onChange={(next) =>
                setConfig((c) => ({ ...c, bingo_clip_length: parseBingoClipLength(next) }))
              }
            />
            {/* Changing the length leaves the old clips in place until this
                runs, so nothing is lost by trying a different length. */}
            {staleClips.length > 0 ? (
              <NeoButton
                type="button"
                variant="accent"
                size="sm"
                className="shrink-0"
                disabled={clipBusy}
                onClick={() => void generateClips(staleClips, clipLen)}
              >
                <IconRefresh className="size-3.5" aria-hidden />
                {clipBusy
                  ? `Cutting ${clipProgress?.done ?? 0}/${clipProgress?.total ?? 0}`
                  : `Regenerate ${staleClips.length} clip${staleClips.length === 1 ? '' : 's'}`}
              </NeoButton>
            ) : null}
          </div>
          {clipError ? (
            <p className="text-destructive text-xs" role="alert">
              {clipError}
            </p>
          ) : null}
        </div>
        <BingoWinningComboEditor
          config={{
            ...config,
            bingo_line_points: config.bingo_line_points ?? 100,
            bingo_points_per_correct: config.bingo_points_per_correct ?? 10,
          }}
          setConfig={setConfig}
        />
      </>
    )
  }

  if (section === 'designer') {
    // BackgroundDesigner is already a card with its own heading; wrapping it
    // gave a card inside a card with two titles.
    return (
      <BackgroundDesigner
          config={config}
          setConfig={setConfig}
          gameName={gameName}
          previewSubtitle="Listen and mark your card"
          onUploadBackground={(file) =>
            uploadGameFile(organizationId, `bingo/bg-${newGameId()}`, file)
        }
      />
    )
  }

  return (
    <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
      {/* #23: bingo games only PICK from the catalog. Uploading happens in
          Games → Music Catalog (single source of truth). */}
      <MusicCatalogPicker
        organizationId={organizationId}
        existingTrackIds={existingTrackIds}
        onAdd={(newTracks) => {
          setConfig((c) => ({
            ...c,
            tracks: [...(c.tracks ?? []), ...newTracks],
          }))
          // Clips belong to the game, so anything arriving at a different
          // length is cut straight away rather than waiting for a button.
          void generateClips(
            newTracks.filter((t) => t.audioUrl && t.clipDurationSeconds !== clipLen),
            clipLen,
          )
        }}
      />
      <p className="text-muted-foreground text-xs">
        Need more songs? Upload them in <strong>Games → Music Catalog</strong>, then add
        them here.
      </p>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Tracks ({tracks.length})</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                tracks: [
                  ...(c.tracks ?? []),
                  { id: newGameId(), title: 'Track', artist: 'Artist', audioUrl: '' },
                ],
              }))
            }
          >
            <IconPlus className="size-4" />
            Add track
          </Button>
        </div>
        {tracks.length < 5 ? (
          <p className="text-muted-foreground mb-3 text-sm">
            Add at least 5 tracks for bingo (25+ recommended for larger events).
          </p>
        ) : null}
        {clipBusy ? (
          <p className="text-muted-foreground mb-3 text-sm">
            Cutting {clipLen}s clips… {clipProgress?.done ?? 0}/{clipProgress?.total ?? 0}
          </p>
        ) : staleClips.length > 0 ? (
          <div className="mb-3 space-y-2">
            <p className="text-amber-700 text-sm">
              {staleClips.length} track{staleClips.length === 1 ? '' : 's'} need a {clipLen}s clip
              before live bingo.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void generateClips(staleClips, clipLen)}
            >
              Generate {staleClips.length} clip{staleClips.length === 1 ? '' : 's'}
            </Button>
          </div>
        ) : tracks.some((t) => t.audioUrl) ? (
          <p className="text-muted-foreground mb-3 text-sm">
            All tracks have {clipLen}s clips ready.
          </p>
        ) : null}
        {clipError ? (
          <p className="text-destructive mb-3 text-sm" role="alert">
            {clipError}
          </p>
        ) : null}
        {tracks.map((t) => (
          <Card key={t.id} className="border-border/80 mb-3 space-y-2 p-4">
            <Input
              placeholder="Title"
              value={t.title}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  tracks: tracks.map((tr) =>
                    tr.id === t.id ? { ...tr, title: e.target.value } : tr,
                  ),
                }))
              }
              className="bg-background"
            />
            <Input
              placeholder="Artist"
              value={t.artist}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  tracks: tracks.map((tr) =>
                    tr.id === t.id ? { ...tr, artist: e.target.value } : tr,
                  ),
                }))
              }
              className="bg-background"
            />
            <div className="flex flex-wrap gap-2 text-xs">
              {t.audioUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadUrl(t.audioUrl, `${t.title}-full.mp3`)}
                >
                  Download full
                </Button>
              ) : null}
              {t.clipUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadUrl(t.clipUrl!, `${t.title}-clip.mp3`)}
                >
                  Download clip ({t.clipDurationSeconds ?? clipLen}s)
                </Button>
              ) : null}
              {t.audioUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={clipBusy}
                  onClick={() => void generateClips([t], clipLen)}
                >
                  Generate clip
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    tracks: (c.tracks ?? []).filter((x) => x.id !== t.id),
                  }))
                }
              >
                Remove
              </Button>
            </div>
            {t.clipUrl ? (
              <p className="text-muted-foreground text-xs">
                Clip ready ({t.clipDurationSeconds ?? clipLen}s) for live play
              </p>
            ) : t.audioUrl ? (
              <p className="text-amber-700 text-xs">Full song uploaded — generate clip</p>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">Replace full song</Label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  void uploadTrackAudio(t.id, file, Boolean(clipLen)).catch((err) =>
                    setClipError(err instanceof Error ? err.message : 'Upload failed'),
                  )
                }}
              />
            </div>
          </Card>
        ))}
      </div>
    </Card>
  )
}

