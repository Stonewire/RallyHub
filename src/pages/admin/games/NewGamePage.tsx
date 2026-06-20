import {
  Camera,
  Clapperboard,
  FileText,
  HelpCircle,
  Music2,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import { QueryLoading } from '@/components/admin/QueryState'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor, validateTextGameConfig } from '@/components/games/TextGameEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateGame } from '@/hooks/use-games'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import type { GameType, PointsType } from '@/types/database'
import type { GameConfig, QuizQuestion } from '@/types/game-config'
const TYPES: {
  type: GameType
  label: string
  icon: typeof Camera
  description: string
}[] = [
  { type: 'photo', label: 'Photo', icon: Camera, description: 'Image-based challenge' },
  { type: 'video', label: 'Video', icon: Clapperboard, description: 'Video challenge with example clip' },
  { type: 'text', label: 'Text', icon: FileText, description: 'Typed or multiple-choice text answers' },
  { type: 'quiz', label: 'Quiz', icon: HelpCircle, description: 'Timed questions and optional rounds' },
  { type: 'music_bingo', label: 'Music Bingo', icon: Music2, description: 'Tracks and bonus challenges' },
]

function emptyQuestion(): QuizQuestion {
  const answers = [1, 2, 3, 4].map((n) => ({
    id: newGameId(),
    text: `Answer ${n}`,
  }))
  return {
    id: newGameId(),
    text: '',
    answers,
    correctAnswerId: answers[0].id,
  }
}

export function AdminGamesNewPage() {
  const navigate = useNavigate()
  const isPlatformLibrary = useIsPlatformGamesAdmin()
  const organizationId = useAdminOrganizationId()
  const orgLoading = useAdminOrganizationLoading()
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

  if (orgLoading) {
    return (
      <AdminPageShell
        title="New game"
        subtitle="Create a new game."
        backTo="/admin/games"
        backLabel="Back to games"
      >
        <QueryLoading rows={6} />
      </AdminPageShell>
    )
  }

  if (!organizationId) {
    return (
      <AdminPageShell
        title="New game"
        subtitle="Create a new game."
        backTo="/admin/games"
        backLabel="Back to games"
      >
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
    if (type === 'text' && !name) setName('New Text Challenge')
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
    if (gameType === 'text') {
      const textErr = validateTextGameConfig(config)
      if (textErr) {
        setError(textErr)
        return
      }
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
        is_platform_template: isPlatformLibrary,
        config: {
          ...config,
          example_video_url: gameType === 'video' ? exampleVideoUrl : undefined,
          max_video_duration_seconds:
            gameType === 'video'
              ? Math.max(1, videoMaxMinutes * 60 + videoMaxSeconds)
              : undefined,
          ...(gameType === 'text'
            ? {
                text_correct_answers: (config.text_correct_answers ?? []).filter(
                  (a) => a.length > 0,
                ),
              }
            : {}),
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
      <AdminPageShell
        title="New game"
        subtitle="Choose a game type to get started."
        backTo="/admin/games"
        backLabel="Back to games"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {TYPES.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className="border-border/80 hover:border-[#FFC107]/60 bg-card text-left rounded-xl border p-6 shadow-sm transition-colors"
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
  const isText = gameType === 'text'

  return (
    <AdminPageShell
      title={`New ${TYPES.find((t) => t.type === gameType)?.label ?? 'game'}`}
      subtitle="Configure your game and save when ready."
      backTo="/admin/games"
      backLabel="Back to games"
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => setStep('type')}>
            Back
          </Button>
          <NeoButton type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save game'}
          </NeoButton>
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
              onFile={(f) => void handleFile(f, setCoverUrl, `covers/${newGameId()}`)}
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
                    void handleFile(f, setExampleVideoUrl, `videos/${newGameId()}`)
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
                void handleFile(f, setSolutionImageUrl, `solutions/${newGameId()}`)
              }
              preview={solutionImageUrl}
            />
            <ReadOnlyMembershipPanel />
          </Card>
        )}

        {isText && (
          <>
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
                onFile={(f) => void handleFile(f, setCoverUrl, `covers/${newGameId()}`)}
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
            </Card>
            <TextGameEditor config={config} setConfig={setConfig} />
          </>
        )}

        {gameType === 'quiz' && (
          <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label>Quiz name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
            </div>
            <FileField
              label="Cover photo"
              onFile={(f) => void handleFile(f, setCoverUrl, `quiz/cover-${newGameId()}`)}
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

function ColorPickers({
  config,
  setConfig,
}: {
  config: GameConfig
  setConfig: React.Dispatch<React.SetStateAction<GameConfig>>
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
            value={config[key] ?? '#333333'}
            onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
            className="size-10 w-full cursor-pointer rounded border"
          />
        </div>
      ))}
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
