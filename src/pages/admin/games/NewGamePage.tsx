import {
  Camera,
  Clapperboard,
  HelpCircle,
  Music2,
  Plus,
} from 'lucide-react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QuizEditor } from '@/components/games/QuizEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateGame } from '@/hooks/use-games'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { uploadAsset } from '@/lib/storage'
import type { GameType, PointsType } from '@/types/database'
import type {
  BonusChallenge,
  GameConfig,
  QuizQuestion,
} from '@/types/game-config'
const TYPES: {
  type: GameType
  label: string
  icon: typeof Camera
  description: string
}[] = [
  { type: 'photo', label: 'Photo', icon: Camera, description: 'Image-based challenge' },
  { type: 'video', label: 'Video', icon: Clapperboard, description: 'Video challenge with example clip' },
  { type: 'quiz', label: 'Quiz', icon: HelpCircle, description: 'Timed questions and optional rounds' },
  { type: 'music_bingo', label: 'Music Bingo', icon: Music2, description: 'Tracks and bonus challenges' },
]

function newId() {
  return crypto.randomUUID()
}

function emptyQuestion(): QuizQuestion {
  const answers = [1, 2, 3, 4].map((n) => ({
    id: newId(),
    text: `Answer ${n}`,
  }))
  return {
    id: newId(),
    text: '',
    answers,
    correctAnswerId: answers[0].id,
  }
}

async function uploadGameFile(orgId: string, path: string, file: File) {
  return uploadAsset('game-assets', `${orgId}/${path}`, file)
}

export function AdminGamesNewPage() {
  const navigate = useNavigate()
  const organizationId = useOrganizationId()
  const createGame = useCreateGame(organizationId)

  const [step, setStep] = useState<'type' | 'editor'>('type')
  const [gameType, setGameType] = useState<GameType | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared / photo / video
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [pointsType, setPointsType] = useState<PointsType>('static')
  const [pointsStatic, setPointsStatic] = useState(50)
  const [pointsMin, setPointsMin] = useState(10)
  const [pointsMax, setPointsMax] = useState(100)
  const [solutionDescription, setSolutionDescription] = useState('')
  const [solutionImageUrl, setSolutionImageUrl] = useState<string | null>(null)
  const [exampleVideoUrl, setExampleVideoUrl] = useState<string | null>(null)
  const [videoMaxMinutes, setVideoMaxMinutes] = useState(2)
  const [videoMaxSeconds, setVideoMaxSeconds] = useState(0)

  // Quiz / music bingo config
  const [config, setConfig] = useState<GameConfig>({
    timer_seconds: 20,
    max_video_duration_seconds: 120,
    questions: [emptyQuestion()],
    rounds_enabled: false,
    rounds: [],
    tracks: [],
    bonus_challenges: [],
  })

  if (!organizationId) {
    return (
      <AdminPageShell title="New game" subtitle="Create a new game.">
        <p className="text-muted-foreground text-sm">
          Link your profile to an organization in Supabase first.
        </p>
      </AdminPageShell>
    )
  }

  function selectType(type: GameType) {
    setGameType(type)
    setStep('editor')
    if (type === 'quiz' && !name) setName('New Quiz')
    if (type === 'music_bingo' && !name) setName('Music Bingo')
  }

  async function handleFile(
    file: File | undefined,
    setter: (url: string) => void,
    path: string,
  ) {
    if (!file || !organizationId) return
    const url = await uploadGameFile(organizationId, path, file)
    setter(url)
  }

  async function handleSave() {
    if (!organizationId) return
    if (!gameType || !name.trim()) {
      setError('Game name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createGame.mutateAsync({
        organization_id: organizationId,
        name: name.trim(),
        type: gameType,
        description: description || null,
        cover_url: coverUrl ?? null,
        points_type: gameType === 'quiz' || gameType === 'music_bingo' ? 'static' : pointsType,
        points_static: pointsType === 'static' ? pointsStatic : null,
        points_min: pointsType === 'range' ? pointsMin : null,
        points_max: pointsType === 'range' ? pointsMax : null,
        solution_description:
          gameType === 'photo' || gameType === 'video' ? solutionDescription || null : null,
        solution_image_url:
          gameType === 'photo' || gameType === 'video' ? solutionImageUrl : null,
        status: 'draft',
        config: {
          ...config,
          example_video_url: gameType === 'video' ? exampleVideoUrl : undefined,
          max_video_duration_seconds:
            gameType === 'video'
              ? Math.max(1, videoMaxMinutes * 60 + videoMaxSeconds)
              : undefined,
        },
      })
      navigate('/admin/games', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'type') {
    return (
      <AdminPageShell title="New game" subtitle="Choose a game type to get started.">
        <div className="grid gap-4 sm:grid-cols-2">
          {TYPES.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className="border-border/80 hover:border-[#FFCB03]/60 bg-card text-left rounded-xl border p-6 shadow-sm transition-colors"
            >
              <Icon className="text-foreground mb-4 size-10" strokeWidth={1.5} />
              <h3 className="text-foreground text-lg font-semibold">{label}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            </button>
          ))}
        </div>
      </AdminPageShell>
    )
  }

  const isPhotoVideo = gameType === 'photo' || gameType === 'video'

  return (
    <AdminPageShell
      title={`New ${TYPES.find((t) => t.type === gameType)?.label ?? 'game'}`}
      subtitle="Configure your game and save when ready."
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => setStep('type')}>
            Back
          </Button>
          <AccentButton type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save game'}
          </AccentButton>
        </>
      }
    >
      {error ? (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        {(gameType === 'quiz' || gameType === 'music_bingo') && (
          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label>Game name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
            </div>
          </Card>
        )}

        {isPhotoVideo && (
          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label>Game name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <FileField
              label="Cover image"
              onFile={(f) => void handleFile(f, setCoverUrl, `covers/${newId()}`)}
              preview={coverUrl}
            />
            <PointsEditor
              pointsType={pointsType}
              setPointsType={setPointsType}
              pointsStatic={pointsStatic}
              setPointsStatic={setPointsStatic}
              pointsMin={pointsMin}
              setPointsMin={setPointsMin}
              pointsMax={pointsMax}
              setPointsMax={setPointsMax}
            />
            {gameType === 'video' && (
              <>
                <div className="space-y-2">
                  <Label>Max video duration</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={videoMaxMinutes}
                        onChange={(e) =>
                          setVideoMaxMinutes(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="bg-background w-20"
                      />
                      <span className="text-muted-foreground text-sm">min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={videoMaxSeconds}
                        onChange={(e) =>
                          setVideoMaxSeconds(
                            Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                          )
                        }
                        className="bg-background w-20"
                      />
                      <span className="text-muted-foreground text-sm">sec</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Stored as{' '}
                    {Math.max(1, videoMaxMinutes * 60 + videoMaxSeconds)} seconds total
                  </p>
                </div>
                <FileField
                  label="Example video (visible to participants)"
                  accept="video/*"
                  onFile={(f) =>
                    void handleFile(f, setExampleVideoUrl, `videos/${newId()}`)
                  }
                  preview={exampleVideoUrl}
                />
              </>
            )}
          </Card>
        )}

        {isPhotoVideo && (
          <Card className="border-border/80 space-y-4 border-dashed bg-muted/20 p-6 shadow-sm">
            <h3 className="text-foreground text-sm font-semibold uppercase tracking-wider">
              Facilitator only
            </h3>
            <div className="space-y-2">
              <Label>Solution description</Label>
              <textarea
                value={solutionDescription}
                onChange={(e) => setSolutionDescription(e.target.value)}
                rows={3}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <FileField
              label="Solution image"
              onFile={(f) =>
                void handleFile(f, setSolutionImageUrl, `solutions/${newId()}`)
              }
              preview={solutionImageUrl}
            />
            <ReadOnlyMembershipPanel />
          </Card>
        )}

        {gameType === 'quiz' && (
          <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label>Quiz name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
            </div>
            <FileField
              label="Cover photo"
              onFile={(f) => void handleFile(f, setCoverUrl, `quiz/cover-${newId()}`)}
              preview={coverUrl}
            />
            <ColorPickers config={config} setConfig={setConfig} />
            <QuizEditor
              config={config}
              setConfig={setConfig}
              onUploadQuestionPhoto={async (questionId, file) => {
                const url = await uploadGameFile(
                  organizationId,
                  `quiz/q-${questionId}`,
                  file,
                )
                setConfig((c) => ({
                  ...c,
                  questions: (c.questions ?? []).map((q) =>
                    q.id === questionId ? { ...q, photoUrl: url } : q,
                  ),
                }))
              }}
            />
          </Card>
        )}

        {gameType === 'music_bingo' && (
          <MusicBingoEditor
            config={config}
            setConfig={setConfig}
            organizationId={organizationId}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
          />
        )}
      </div>

      <FormSaveFooter
        onSave={() => void handleSave()}
        saving={saving}
        label="Save game"
      />
    </AdminPageShell>
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

function PointsEditor({
  pointsType,
  setPointsType,
  pointsStatic,
  setPointsStatic,
  pointsMin,
  setPointsMin,
  pointsMax,
  setPointsMax,
}: {
  pointsType: PointsType
  setPointsType: (v: PointsType) => void
  pointsStatic: number
  setPointsStatic: (v: number) => void
  pointsMin: number
  setPointsMin: (v: number) => void
  pointsMax: number
  setPointsMax: (v: number) => void
}) {
  return (
    <div className="space-y-3">
      <Label>Points</Label>
      <div className="flex gap-2">
        {(['static', 'range'] as const).map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={pointsType === t ? 'secondary' : 'outline'}
            onClick={() => setPointsType(t)}
          >
            {t === 'static' ? 'Static' : 'Range'}
          </Button>
        ))}
      </div>
      {pointsType === 'static' ? (
        <Input
          type="number"
          value={pointsStatic}
          onChange={(e) => setPointsStatic(Number(e.target.value))}
          className="bg-background max-w-[8rem]"
        />
      ) : (
        <div className="flex gap-3">
          <Input
            type="number"
            placeholder="Min"
            value={pointsMin}
            onChange={(e) => setPointsMin(Number(e.target.value))}
            className="bg-background max-w-[8rem]"
          />
          <Input
            type="number"
            placeholder="Max"
            value={pointsMax}
            onChange={(e) => setPointsMax(Number(e.target.value))}
            className="bg-background max-w-[8rem]"
          />
        </div>
      )}
    </div>
  )
}

function ReadOnlyMembershipPanel() {
  return (
    <div className="border-border/60 bg-background rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        Groups & events
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        This game is not in any groups or events yet. Add it from the Games list
        or when creating an event.
      </p>
    </div>
  )
}

function MusicBingoEditor({
  config,
  setConfig,
  organizationId,
  coverUrl,
  setCoverUrl,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  organizationId: string
  coverUrl: string | null
  setCoverUrl: (v: string | null) => void
}) {
  const tracks = config.tracks ?? []
  const bonuses = config.bonus_challenges ?? []

  return (
  <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
      <FileField
        label="Cover image"
        onFile={async (f) => {
          if (!f) return
          setCoverUrl(await uploadGameFile(organizationId, `bingo/cover-${newId()}`, f))
        }}
        preview={coverUrl}
      />
      <FileField
        label="Background image (optional)"
        onFile={async (f) => {
          if (!f) return
          const url = await uploadGameFile(organizationId, `bingo/bg-${newId()}`, f)
          setConfig((c) => ({ ...c, background_url: url }))
        }}
        preview={config.background_url ?? null}
      />
      <ColorPickers config={config} setConfig={setConfig} />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Tracks</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                tracks: [
                  ...(c.tracks ?? []),
                  { id: newId(), title: 'Track', artist: 'Artist', audioUrl: '' },
                ],
              }))
            }
          >
            <Plus className="size-4" />
            Add track
          </Button>
        </div>
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
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void uploadGameFile(organizationId, `bingo/audio-${t.id}`, file).then(
                  (url) =>
                    setConfig((c) => ({
                      ...c,
                      tracks: tracks.map((tr) =>
                        tr.id === t.id ? { ...tr, audioUrl: url } : tr,
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
                id: newId(),
                text: `Answer ${n}`,
              }))
              const ch: BonusChallenge = {
                id: newId(),
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
                    void uploadGameFile(
                      organizationId,
                      `bingo/bonus-${b.id}-q`,
                      file,
                    ).then((url) =>
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
                  void uploadGameFile(
                    organizationId,
                    `bingo/bonus-${b.id}-v`,
                    file,
                  ).then((url) =>
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
                                ans.id === a.id
                                  ? { ...ans, text: e.target.value }
                                  : ans,
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
