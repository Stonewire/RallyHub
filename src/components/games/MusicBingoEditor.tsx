import { IconRefresh } from '@/components/icons'
import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { AssetField } from '@/components/games/AssetField'
import { BackgroundDesigner } from '@/components/games/BackgroundDesigner'
import { BingoTrackPicker } from '@/components/games/BingoTrackPicker'
import { BingoWinningComboEditor } from '@/components/games/BingoWinningComboEditor'
import { NeoButton, SegmentedPill } from '@/components/neo-minimal'
import { Label } from '@/components/ui/label'
import { runClipJobs, useClipJobs } from '@/lib/bingo-clip-jobs'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import {
  BINGO_CLIP_LENGTHS,
  bingoClipLength,
  parseBingoClipLength,
} from '@/lib/music-track-clips'
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
  const { t } = useTranslation('admin')
  const tracks = useMemo(() => config.tracks ?? [], [config.tracks])
  const clipLen = bingoClipLength(config)
  const jobs = useClipJobs()

  // Clips belong to the game, so a track carrying a clip cut at a different
  // length counts as stale and has to be cut again.
  const staleClips = tracks.filter(
    (t) => t.audioUrl?.trim() && (!t.clipUrl?.trim() || t.clipDurationSeconds !== clipLen),
  )

  function saveTrack(track: MusicTrack) {
    setConfig((c) => ({
      ...c,
      tracks: (c.tracks ?? []).map((t) => (t.id === track.id ? track : t)),
    }))
  }

  function addTracks(added: MusicTrack[]) {
    if (added.length === 0) return
    setConfig((c) => ({ ...c, tracks: [...(c.tracks ?? []), ...added] }))
    // Clips are cut straight away rather than behind a button: a track without
    // one cannot be played live, so adding and preparing are the same action.
    void runClipJobs(
      added.filter((t) => t.audioUrl && t.clipDurationSeconds !== clipLen),
      organizationId,
      clipLen,
      saveTrack,
    )
  }

  function removeTracks(ids: string[]) {
    const drop = new Set(ids)
    setConfig((c) => ({ ...c, tracks: (c.tracks ?? []).filter((t) => !drop.has(t.id)) }))
  }

  // 'settings' fills Primary settings, 'designer' the right-hand card, and
  // 'tracks' the full-width area below, matching the other game types.
  if (section === 'settings') {
    return (
      <>
        <AssetField
          label={t('games.bingo.coverImage')}
                cropCover
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
            <Label className="shrink-0">{t('games.bingo.clipLength')}</Label>
            <SegmentedPill
              size="sm"
              className="min-w-32 flex-1"
              aria-label={t('games.bingo.clipLength')}
              options={BINGO_CLIP_LENGTHS.map((len) => ({
                value: String(len),
                label: t('games.bingo.secondsShort', { seconds: len }),
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
                disabled={jobs.running}
                onClick={() => void runClipJobs(staleClips, organizationId, clipLen, saveTrack)}
              >
                <IconRefresh className="size-3.5" aria-hidden />
                {jobs.running
                  ? t('games.bingo.cuttingClips')
                  : t('games.bingo.regenerateClips', { count: staleClips.length })}
              </NeoButton>
            ) : null}
          </div>
          {jobs.error ? (
            <p className="text-destructive text-xs" role="alert">
              {jobs.error}
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
        previewSubtitle={t('games.bingo.previewSubtitle')}
        onUploadBackground={(file) =>
          uploadGameFile(organizationId, `bingo/bg-${newGameId()}`, file)
        }
      />
    )
  }

  return (
    <BingoTrackPicker
      organizationId={organizationId}
      gameTracks={tracks}
      clipLength={clipLen}
      onAdd={addTracks}
      onRemove={removeTracks}
    />
  )
}
