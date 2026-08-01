import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  IconMusicBingo,
  IconPhoto,
  IconPuzzle,
  IconQuiz,
  IconText,
  IconVideo,
} from '@/components/icons'
import { AssetField } from '@/components/games/AssetField'
import { PhotoVideoFields } from '@/components/games/PhotoVideoFields'
import { NeoButton } from '@/components/neo-minimal'
import { QueryLoading } from '@/components/admin/QueryState'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { PuzzleEditor, validatePuzzleConfig } from '@/components/games/PuzzleEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor, validateTextGameConfig } from '@/components/games/TextGameEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useCreateGame } from '@/hooks/use-games'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import { sanitizeRichText } from '@/lib/rich-text'
import type { GameType, PointsType } from '@/types/database'
import type { GameConfig, QuizQuestion } from '@/types/game-config'
const TYPES: {
  type: GameType
  label: string
  icon: typeof IconPhoto
  description: string
}[] = [
  { type: 'photo', label: 'Photo', icon: IconPhoto, description: 'Image-based challenge' },
  { type: 'video', label: 'Video', icon: IconVideo, description: 'Video challenge with example clip' },
  { type: 'text', label: 'Text', icon: IconText, description: 'Typed or multiple-choice text answers' },
  { type: 'quiz', label: 'Quiz', icon: IconQuiz, description: 'Timed questions and optional rounds' },
  { type: 'music_bingo', label: 'Music Bingo', icon: IconMusicBingo, description: 'Songs and a live bingo card' },
  { type: 'puzzle', label: 'Puzzle', icon: IconPuzzle, description: 'Wordle, matching, and upcoming puzzle formats' },
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
  const [videoMaxMinutes, setVideoMaxMinutes] = useState(0)
  const [videoMaxSeconds, setVideoMaxSeconds] = useState(30)

  // Quiz / music bingo config
  const [config, setConfig] = useState<GameConfig>({
    timer_seconds: 20,
    max_video_duration_seconds: 30,
    questions: [emptyQuestion()],
    rounds_enabled: false,
    rounds: [],
    tracks: [],
    puzzle_type: 'wordle',
    puzzle_wordle_answer: 'TEAM',
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
    if (type === 'puzzle' && !name) setName('New Puzzle')
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
      const textErr = validateTextGameConfig(config, pointsType === 'range')
      if (textErr) {
        setError(textErr)
        return
      }
    }
    if (gameType === 'puzzle') {
      const puzzleError = validatePuzzleConfig(config)
      if (puzzleError) {
        setError(puzzleError)
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
        description: description ? sanitizeRichText(description) : null,
        cover_url: coverUrl ?? null,
        points_type:
          gameType === 'quiz' || gameType === 'music_bingo' || gameType === 'puzzle'
            ? 'static'
            : pointsType,
        points_static:
          gameType === 'puzzle' || gameType === 'quiz' || pointsType === 'static'
            ? pointsStatic
            : null,
        points_min: gameType !== 'puzzle' && pointsType === 'range' ? pointsMin : null,
        points_max: gameType !== 'puzzle' && pointsType === 'range' ? pointsMax : null,
        solution_description:
          gameType === 'photo' || gameType === 'video' ? solutionDescription || null : null,
        solution_image_url:
          gameType === 'photo' || gameType === 'video' ? solutionImageUrl : null,
        status: 'draft',
        is_platform_template: isPlatformLibrary,
        config: {
          ...config,
          example_video_url: isPhotoVideo ? exampleVideoUrl : undefined,
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
        <div className="border-nm-slate-800 bg-card mx-auto max-w-3xl rounded-lg border-2 p-4 shadow-lg" data-tour="game-type-picker">
          <div className="border-border mb-4 border-b pb-3">
            <h2 className="text-foreground text-sm font-bold">Select game type</h2>
            <p className="text-muted-foreground mt-1 text-xs">Choose the format. You can configure all content on the next screen.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className="border-border hover:border-primary hover:bg-primary/5 bg-background text-left rounded-md border p-4 transition-[background-color,border-color,transform] hover:-translate-y-0.5"
            >
              <span className="bg-nm-slate-100 mb-3 flex size-9 items-center justify-center rounded-md">
                <Icon className="text-nm-slate-700 size-8" />
              </span>
              <h3 className="text-foreground text-sm font-semibold">{label}</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
            </button>
          ))}
          </div>
        </div>
      </AdminPageShell>
    )
  }

  const isPhotoVideo = gameType === 'photo' || gameType === 'video'
  const isText = gameType === 'text'
  const isPuzzle = gameType === 'puzzle'

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
          /* Same component the editor uses. These two screens had drifted into
             separate copies of the same form, which is how creating a game
             ended up with a raw file input and no two-column layout. */
          <PhotoVideoFields
            gameType={gameType}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
            onUploadCover={(file) => uploadGameFile(organizationId!, `covers/${newGameId()}`, file)}
            pointsType={pointsType}
            setPointsType={setPointsType}
            pointsStatic={pointsStatic}
            setPointsStatic={setPointsStatic}
            pointsMin={pointsMin}
            setPointsMin={setPointsMin}
            pointsMax={pointsMax}
            setPointsMax={setPointsMax}
            exampleVideoUrl={exampleVideoUrl}
            setExampleVideoUrl={setExampleVideoUrl}
            onUploadVideo={(file) => uploadGameFile(organizationId!, `videos/${newGameId()}`, file)}
            videoMaxMinutes={videoMaxMinutes}
            setVideoMaxMinutes={setVideoMaxMinutes}
            videoMaxSeconds={videoMaxSeconds}
            setVideoMaxSeconds={setVideoMaxSeconds}
            solutionDescription={solutionDescription}
            setSolutionDescription={setSolutionDescription}
            solutionImageUrl={solutionImageUrl}
            setSolutionImageUrl={setSolutionImageUrl}
            onUploadSolution={(file) => uploadGameFile(organizationId!, `solutions/${newGameId()}`, file)}
            config={config}
            setConfig={setConfig}
            groupsCard={<ReadOnlyMembershipPanel />}
          />
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
              <AssetField
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
            <TextGameEditor
              config={config}
              setConfig={setConfig}
              judged={pointsType === 'range'}
            />
          </>
        )}

        {isPuzzle && (
          <>
            <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
              <div className="space-y-2">
                <Label>Game name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <RichTextEditor value={description} onChange={setDescription} />
              </div>
              <AssetField
                label="Cover image"
                onFile={(f) => void handleFile(f, setCoverUrl, `covers/${newGameId()}`)}
                preview={coverUrl}
              />
              <div className="space-y-2">
                <Label>Maximum points</Label>
                <Input
                  type="number"
                  min={1}
                  value={pointsStatic}
                  onChange={(e) => setPointsStatic(Math.max(1, Number(e.target.value) || 1))}
                  className="max-w-[8rem] bg-background"
                />
                <p className="text-muted-foreground text-xs">
                  The puzzle scoring rule reduces this amount based on guesses or mistakes.
                </p>
              </div>
            </Card>
            <PuzzleEditor config={config} setConfig={setConfig} />
          </>
        )}

        {gameType === 'quiz' && (
          <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label>Quiz name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
            </div>
            <AssetField
              label="Cover photo"
              onFile={(f) => void handleFile(f, setCoverUrl, `quiz/cover-${newGameId()}`)}
              preview={coverUrl}
            />
            <div className="space-y-2">
              <Label>Points / correct</Label>
              {/* Quizzes always wrote points_static, but nothing exposed it, so
                  every new quiz silently scored at the default. The scoring RPC
                  reads this column directly. */}
              <Input
                type="number"
                min={0}
                value={pointsStatic}
                onChange={(e) => setPointsStatic(Math.max(0, Number(e.target.value) || 0))}
                className="bg-background max-w-[8rem]"
              />
              <p className="text-muted-foreground text-xs">
                Awarded to each team that answers a question correctly.
              </p>
            </div>
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
            gameName={name}
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
    <Card className="border-border/80 space-y-2 bg-card p-6 shadow-sm xl:col-start-2">
      <h3 className="text-foreground text-sm font-bold">Groups</h3>
      <p className="text-muted-foreground mt-2 text-sm">
        A game has to exist before it can join a group. Save this one, then pick
        its groups from the editor or the Games list.
      </p>
    </Card>
  )
}
