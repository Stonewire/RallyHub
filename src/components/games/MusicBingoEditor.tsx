import { Plus } from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { BingoWinningComboEditor } from '@/components/games/BingoWinningComboEditor'
import { MusicCatalogPicker } from '@/components/games/MusicCatalogPicker'
import { MusicCatalogUploader } from '@/components/games/MusicCatalogUploader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { extractAudioClip } from '@/lib/extract-audio-clip'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import {
  bingoClipLength,
  clearAllTrackClips,
  downloadUrl,
  ensureMusicTrackClip,
} from '@/lib/music-track-clips'
import { readAudioDuration, suggestClipStart } from '@/lib/audio-metadata'
import { uploadAsset } from '@/lib/storage'
import { audioStorageFilename } from '@/lib/storage-path'
import type { BonusChallenge, GameConfig, MusicTrack } from '@/types/game-config'

type MusicBingoEditorProps = {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  organizationId: string
  coverUrl: string | null
  setCoverUrl: (v: string | null) => void
}

export function MusicBingoEditor({
  config,
  setConfig,
  organizationId,
  coverUrl,
  setCoverUrl,
}: MusicBingoEditorProps) {
  const tracks = config.tracks ?? []
  const bonuses = config.bonus_challenges ?? []
  const [clipBusy, setClipBusy] = useState(false)
  const [clipError, setClipError] = useState<string | null>(null)
  const existingTrackIds = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks])
  const clipLen = bingoClipLength(config)
  const missingClips = tracks.filter(
    (t) =>
      t.audioUrl?.trim() &&
      (!t.clipUrl?.trim() || t.clipDurationSeconds !== clipLen),
  )

  function onClipLengthChange(value: string) {
    const next =
      value === '30' ? 30 : value === '90' ? 90 : null
    if (next === clipLen) return
    const hadClips = tracks.some((t) => t.clipUrl)
    if (hadClips && !window.confirm('Change clip length? Existing generated clips will be cleared.')) {
      return
    }
    setConfig((c) => ({
      ...clearAllTrackClips(c),
      bingo_clip_length: next,
    }))
  }

  async function generateMissingClips() {
    if (!clipLen) {
      setClipError('Select clip length (30 or 90 sec) first.')
      return
    }
    if (missingClips.length === 0) return
    setClipBusy(true)
    setClipError(null)
    try {
      const updated = new Map<string, MusicTrack>()
      for (const track of missingClips) {
        updated.set(track.id, await ensureMusicTrackClip(track, organizationId, clipLen))
      }
      setConfig((c) => ({
        ...c,
        tracks: (c.tracks ?? []).map((t) => updated.get(t.id) ?? t),
      }))
    } catch (err) {
      setClipError(err instanceof Error ? err.message : 'Clip generation failed')
    } finally {
      setClipBusy(false)
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

  async function generateOneClip(track: MusicTrack) {
    if (!clipLen) {
      setClipError('Select clip length first.')
      return
    }
    setClipBusy(true)
    try {
      const next = await ensureMusicTrackClip(track, organizationId, clipLen)
      setConfig((c) => ({
        ...c,
        tracks: (c.tracks ?? []).map((t) => (t.id === track.id ? next : t)),
      }))
    } catch (err) {
      setClipError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setClipBusy(false)
    }
  }

  return (
    <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
      <FileField
        label="Cover image"
        onFile={async (f) => {
          if (!f) return
          setCoverUrl(await uploadGameFile(organizationId, `bingo/cover-${newGameId()}`, f))
        }}
        preview={coverUrl}
      />
      <FileField
        label="Background image (optional)"
        onFile={async (f) => {
          if (!f) return
          const url = await uploadGameFile(organizationId, `bingo/bg-${newGameId()}`, f)
          setConfig((c) => ({ ...c, background_url: url }))
        }}
        preview={config.background_url ?? null}
      />
      <ColorPickers config={config} setConfig={setConfig} />

      <div className="space-y-2">
        <Label>Clip length for live bingo</Label>
        <select
          value={config.bingo_clip_length == null ? '' : String(config.bingo_clip_length)}
          onChange={(e) => onClipLengthChange(e.target.value)}
          className="border-input bg-background max-w-xs rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Select length</option>
          <option value="30">30 seconds</option>
          <option value="90">90 seconds</option>
        </select>
      </div>

      <BingoWinningComboEditor
        config={{
          ...config,
          bingo_line_points: config.bingo_line_points ?? 100,
          bingo_points_per_correct: config.bingo_points_per_correct ?? 10,
        }}
        setConfig={setConfig}
      />

      <MusicCatalogPicker
        organizationId={organizationId}
        existingTrackIds={existingTrackIds}
        onAdd={(newTracks) =>
          setConfig((c) => ({
            ...c,
            tracks: [...(c.tracks ?? []), ...newTracks],
          }))
        }
      />
      <MusicCatalogUploader
        organizationId={organizationId}
        clipLengthSeconds={clipLen}
        onTracksReady={(newTracks) =>
          setConfig((c) => ({
            ...c,
            tracks: [...(c.tracks ?? []), ...newTracks],
          }))
        }
      />
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
            <Plus className="size-4" />
            Add track
          </Button>
        </div>
        {tracks.length < 5 ? (
          <p className="text-muted-foreground mb-3 text-sm">
            Add at least 5 tracks for bingo (25+ recommended for larger events).
          </p>
        ) : null}
        {missingClips.length > 0 ? (
          <div className="mb-3 space-y-2">
            <p className="text-amber-700 text-sm">
              {missingClips.length} track{missingClips.length === 1 ? '' : 's'} need a{' '}
              {clipLen ?? '…'}s clip before live bingo.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={clipBusy || !clipLen}
              onClick={() => void generateMissingClips()}
            >
              {clipBusy ? 'Generating clips…' : `Generate all clips (${missingClips.length})`}
            </Button>
            {clipError ? (
              <p className="text-destructive text-sm" role="alert">
                {clipError}
              </p>
            ) : null}
          </div>
        ) : tracks.some((t) => t.audioUrl) ? (
          <p className="text-muted-foreground mb-3 text-sm">All tracks have 30s clips ready.</p>
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
                  disabled={clipBusy || !clipLen}
                  onClick={() => void generateOneClip(t)}
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
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Bonus challenges</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const answers = [1, 2, 3, 4].map((n) => ({
                id: newGameId(),
                text: `Answer ${n}`,
              }))
              const ch: BonusChallenge = {
                id: newGameId(),
                mediaType: 'photo',
                question: '',
                answers,
                correctAnswerId: answers[0].id,
              }
              setConfig((c) => ({
                ...c,
                bonus_challenges: [...(c.bonus_challenges ?? []), ch],
              }))
            }}
          >
            <Plus className="size-4" />
            Add challenge
          </Button>
        </div>
        {bonuses.map((b) => (
          <Card key={b.id} className="border-border/80 mb-3 space-y-2 p-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={b.mediaType === 'photo' ? 'secondary' : 'outline'}
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    bonus_challenges: bonuses.map((x) =>
                      x.id === b.id ? { ...x, mediaType: 'photo' } : x,
                    ),
                  }))
                }
              >
                Photo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={b.mediaType === 'video' ? 'secondary' : 'outline'}
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    bonus_challenges: bonuses.map((x) =>
                      x.id === b.id ? { ...x, mediaType: 'video' } : x,
                    ),
                  }))
                }
              >
                Video
              </Button>
            </div>
            <Input
              placeholder="Question"
              value={b.question}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  bonus_challenges: bonuses.map((x) =>
                    x.id === b.id ? { ...x, question: e.target.value } : x,
                  ),
                }))
              }
              className="bg-background"
            />
            {b.mediaType === 'photo' ? (
              <div className="space-y-2">
                <Label className="text-xs">Question photo</Label>
                {b.questionImageUrl ? (
                  <img
                    src={b.questionImageUrl}
                    alt=""
                    className="size-24 rounded-lg object-cover"
                  />
                ) : null}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void uploadGameFile(organizationId, `bingo/bonus-${b.id}-q`, file)
                      .then((url) =>
                        setConfig((c) => ({
                          ...c,
                          bonus_challenges: bonuses.map((x) =>
                            x.id === b.id ? { ...x, questionImageUrl: url } : x,
                          ),
                        })),
                      )
                      .catch(() => {})
                  }}
                />
              </div>
            ) : null}
            {b.mediaType === 'video' ? (
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  void uploadGameFile(organizationId, `bingo/bonus-${b.id}-v`, file)
                    .then((url) =>
                      setConfig((c) => ({
                        ...c,
                        bonus_challenges: bonuses.map((x) =>
                          x.id === b.id ? { ...x, mediaUrl: url } : x,
                        ),
                      })),
                    )
                    .catch(() => {})
                }}
              />
            ) : null}
            {b.answers.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={b.correctAnswerId === a.id}
                  onChange={() =>
                    setConfig((c) => ({
                      ...c,
                      bonus_challenges: bonuses.map((x) =>
                        x.id === b.id ? { ...x, correctAnswerId: a.id } : x,
                      ),
                    }))
                  }
                />
                <Input
                  value={a.text}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      bonus_challenges: bonuses.map((x) =>
                        x.id === b.id
                          ? {
                              ...x,
                              answers: x.answers.map((ans) =>
                                ans.id === a.id ? { ...ans, text: e.target.value } : ans,
                              ),
                            }
                          : x,
                      ),
                    }))
                  }
                  className="bg-background flex-1"
                />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </Card>
  )
}

function FileField({
  label,
  accept = 'image/*',
  preview,
  onFile,
}: {
  label: string
  accept?: string
  preview: string | null
  onFile: (file: File | undefined) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        {preview ? (
          accept.startsWith('video') ? (
            <video src={preview} className="max-h-24 rounded-lg" controls />
          ) : (
            <img src={preview} alt="" className="size-20 rounded-lg object-cover" />
          )
        ) : null}
        <Input
          type="file"
          accept={accept}
          className="max-w-xs"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

function ColorPickers({
  config,
  setConfig,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
}) {
  const fields = [
    ['primary_color', 'Primary'],
    ['secondary_color', 'Secondary'],
    ['accent_color', 'Accent'],
  ] as const
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map(([key, label]) => (
        <div key={key} className="space-y-2">
          <Label>{label} (optional)</Label>
          <input
            type="color"
            value={config[key] ?? '#3E3D3E'}
            onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
            className="size-10 w-full cursor-pointer rounded border"
          />
        </div>
      ))}
    </div>
  )
}
