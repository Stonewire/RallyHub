import { Plus } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { MusicCatalogUploader } from '@/components/games/MusicCatalogUploader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import type { BonusChallenge, GameConfig } from '@/types/game-config'

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
      <MusicCatalogUploader
        organizationId={organizationId}
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
            {t.clipUrl ? (
              <p className="text-muted-foreground text-xs">30s clip ready for live play</p>
            ) : null}
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void uploadGameFile(organizationId, `bingo/audio-${t.id}`, file).then((url) =>
                  setConfig((c) => ({
                    ...c,
                    tracks: tracks.map((tr) =>
                      tr.id === t.id
                        ? { ...tr, audioUrl: url, clipUrl: url, clipStartSeconds: 0 }
                        : tr,
                    ),
                  })),
                )
              }}
            />
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
                    void uploadGameFile(organizationId, `bingo/bonus-${b.id}-q`, file).then(
                      (url) =>
                        setConfig((c) => ({
                          ...c,
                          bonus_challenges: bonuses.map((x) =>
                            x.id === b.id ? { ...x, questionImageUrl: url } : x,
                          ),
                        })),
                    )
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
                  void uploadGameFile(organizationId, `bingo/bonus-${b.id}-v`, file).then(
                    (url) =>
                      setConfig((c) => ({
                        ...c,
                        bonus_challenges: bonuses.map((x) =>
                          x.id === b.id ? { ...x, mediaUrl: url } : x,
                        ),
                      })),
                  )
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
