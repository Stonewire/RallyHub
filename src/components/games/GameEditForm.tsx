import { useEffect, useState, type ReactNode } from 'react'

import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AssetField } from '@/components/games/AssetField'
import { InstallGameModal } from '@/components/rallyhub/InstallGameModal'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { PuzzleEditor, validatePuzzleConfig } from '@/components/games/PuzzleEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor, validateTextGameConfig } from '@/components/games/TextGameEditor'
import { FlipSwitch, NeoButton } from '@/components/neo-minimal'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { GAME_TYPE_LABELS, useGame, useUpdateGame } from '@/hooks/use-games'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import { useNotification } from '@/contexts/notification-context'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import { sanitizeRichText } from '@/lib/rich-text'
import type { GameType, PointsType } from '@/types/database'
import type { GameConfig } from '@/types/game-config'

export type GameEditFormRender = {
  headerTitle: string
  headerSubtitle: string
  headerActions: ReactNode
  body: ReactNode
}

type GameEditFormProps = {
  gameId: string
  /** Called after a successful save. Route usage navigates away; panel usage can stay open. */
  onSaved?: () => void
  children: (render: GameEditFormRender) => ReactNode
}

/** Shared game-edit logic/fields, rendered by both the standalone edit page and the side panel. */
export function GameEditForm({ gameId, onSaved, children }: GameEditFormProps) {
  const organizationId = useAdminOrganizationId()
  const orgLoading = useAdminOrganizationLoading()
  const gameQuery = useGame(gameId)
  const updateGame = useUpdateGame(organizationId)
  const isPlatformLibrary = useIsPlatformGamesAdmin()
  const { notify } = useNotification()

  const [hydrated, setHydrated] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [config, setConfig] = useState<GameConfig>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installOpen, setInstallOpen] = useState(false)

  // Photo / video only.
  const [pointsType, setPointsType] = useState<PointsType>('static')
  const [pointsStatic, setPointsStatic] = useState(50)
  const [pointsMin, setPointsMin] = useState(10)
  const [pointsMax, setPointsMax] = useState(100)
  const [solutionDescription, setSolutionDescription] = useState('')
  const [solutionImageUrl, setSolutionImageUrl] = useState<string | null>(null)
  const [exampleVideoUrl, setExampleVideoUrl] = useState<string | null>(null)
  const [videoMaxMinutes, setVideoMaxMinutes] = useState(2)
  const [videoMaxSeconds, setVideoMaxSeconds] = useState(0)

  useEffect(() => {
    if (!gameQuery.data || hydrated) return
    const g = gameQuery.data
    const c = (g.config as GameConfig) ?? {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the local editable form from fetched data, once
    setName(g.name)
    setDescription(g.description ?? '')
    setCoverUrl(g.cover_url)
    setConfig(c)
    setPointsType(g.points_type)
    setPointsStatic(g.points_static ?? 50)
    setPointsMin(g.points_min ?? 10)
    setPointsMax(g.points_max ?? 100)
    setSolutionDescription(g.solution_description ?? '')
    setSolutionImageUrl(g.solution_image_url)
    setExampleVideoUrl(c.example_video_url ?? null)
    const totalSeconds = c.max_video_duration_seconds ?? 30
    setVideoMaxMinutes(Math.floor(totalSeconds / 60))
    setVideoMaxSeconds(totalSeconds % 60)
    setHydrated(true)
  }, [gameQuery.data, hydrated])

  async function handleFile(
    file: File | undefined,
    setter: (url: string) => void,
    path: string,
  ) {
    if (!file || !organizationId) return
    const url = await uploadGameFile(organizationId, path, file)
    setter(url)
  }

  if (orgLoading || gameQuery.isLoading || !hydrated) {
    return children({
      headerTitle: 'Edit game',
      headerSubtitle: '',
      headerActions: null,
      body: <QueryLoading rows={6} />,
    })
  }

  if (!organizationId) {
    return children({
      headerTitle: 'Edit game',
      headerSubtitle: '',
      headerActions: null,
      body: <NoOrganizationMessage />,
    })
  }

  if (gameQuery.isError || !gameQuery.data) {
    return children({
      headerTitle: 'Edit game',
      headerSubtitle: '',
      headerActions: null,
      body: <QueryError message={gameQuery.error?.message ?? 'Game not found'} />,
    })
  }

  const gameType = gameQuery.data.type as GameType
  const tracks = config.tracks ?? []

  async function handleSave() {
    if (!name.trim()) {
      setError('Game name is required.')
      return
    }
    if (gameType === 'music_bingo' && tracks.length < 5) {
      setError('Music bingo needs at least 5 tracks.')
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
      const isPhotoVideo = gameType === 'photo' || gameType === 'video'
      // Puzzles always score from a single maximum, so they store static points only.
      const isPuzzle = gameType === 'puzzle'
      // Quizzes are included: score_current_quiz_question reads points_static
      // as the per-correct-answer award, so it has to be written.
      const isQuiz = gameType === 'quiz'
      const hasPoints = isPhotoVideo || gameType === 'text' || isPuzzle || isQuiz
      await updateGame.mutateAsync({
        gameId,
        patch: {
          name: name.trim(),
          description: description ? sanitizeRichText(description) : null,
          cover_url: coverUrl,
          ...(hasPoints
            ? {
                points_type: isPuzzle || isQuiz ? 'static' : pointsType,
                points_static:
                  isPuzzle || isQuiz || pointsType === 'static' ? pointsStatic : null,
                points_min:
                  !isPuzzle && !isQuiz && pointsType === 'range' ? pointsMin : null,
                points_max:
                  !isPuzzle && !isQuiz && pointsType === 'range' ? pointsMax : null,
              }
            : {}),
          ...(isPhotoVideo
            ? {
                solution_description: solutionDescription || null,
                solution_image_url: solutionImageUrl,
              }
            : {}),
          config:
            gameType === 'text'
              ? {
                  ...config,
                  text_correct_answers: (config.text_correct_answers ?? []).filter(
                    (a) => a.length > 0,
                  ),
                }
              : gameType === 'video'
                ? {
                    ...config,
                    example_video_url: exampleVideoUrl,
                    max_video_duration_seconds: Math.max(
                      1,
                      videoMaxMinutes * 60 + videoMaxSeconds,
                    ),
                  }
                : gameType === 'photo'
                  ? { ...config, example_video_url: exampleVideoUrl }
                  : config,
        },
      })
      notify('Game saved')
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const headerActions = (
    <>
      {isPlatformLibrary && gameQuery.data.is_platform_template ? (
        <Button type="button" variant="outline" onClick={() => setInstallOpen(true)}>
          Install to clients
        </Button>
      ) : null}
      <NeoButton
        type="button"
        variant="primary"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </NeoButton>
    </>
  )

  const body = (
    <>
      {error ? (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label>Game name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
        </Card>

        {gameType === 'quiz' ? (
          <>
            <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
              <AssetField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadGameFile(organizationId, `covers/${gameId}`, file)
                  setCoverUrl(url)
                }}
                onUrl={setCoverUrl}
                showPreviewPanel
              />
              <div className="space-y-2">
                <Label>Points / correct</Label>
                {/* Written to games.points_static, which is what the
                    score_current_quiz_question RPC reads. A config field here
                    would never be consulted by scoring. */}
                <Input
                  type="number"
                  min={0}
                  value={pointsStatic}
                  onChange={(e) =>
                    setPointsStatic(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="bg-background max-w-[8rem]"
                />
                <p className="text-muted-foreground text-xs">
                  Awarded to each team that answers a question correctly.
                </p>
              </div>
            </Card>
            <QuizEditor
            config={config}
            setConfig={setConfig}
            onUploadQuestionPhoto={async (questionId, file) => {
              const url = await uploadGameFile(organizationId, `quiz/q-${questionId}`, file)
              setConfig((c) => ({
                ...c,
                questions: (c.questions ?? []).map((q) =>
                  q.id === questionId ? { ...q, photoUrl: url } : q,
                ),
              }))
            }}
            />
          </>
        ) : null}

        {gameType === 'music_bingo' ? (
          <MusicBingoEditor
            config={config}
            setConfig={setConfig}
            organizationId={organizationId}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
          />
        ) : null}

        {gameType === 'text' ? (
          <>
            <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
              <AssetField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadGameFile(organizationId, `covers/${gameId}`, file)
                  setCoverUrl(url)
                }}
                onUrl={setCoverUrl}
                showPreviewPanel
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
        ) : null}

        {gameType === 'puzzle' ? (
          <>
            <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
              <AssetField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadGameFile(organizationId, `covers/${gameId}`, file)
                  setCoverUrl(url)
                }}
                onUrl={setCoverUrl}
                showPreviewPanel
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
        ) : null}

        {gameType === 'photo' || gameType === 'video' ? (
          <>
            <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
              <AssetField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadGameFile(organizationId, `covers/${gameId}`, file)
                  setCoverUrl(url)
                }}
                onUrl={setCoverUrl}
                showPreviewPanel
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
              {gameType === 'video' ? (
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
                    Stored as {Math.max(1, videoMaxMinutes * 60 + videoMaxSeconds)} seconds
                    total
                  </p>
                </div>
              ) : null}
              <AssetField
                label={
                  gameType === 'video'
                    ? 'Example video (visible to participants)'
                    : 'Example / instructional video (optional, visible to participants)'
                }
                accept="video/*"
                preview={exampleVideoUrl}
                onFile={(file) =>
                  void handleFile(file, setExampleVideoUrl, `videos/${newGameId()}`)
                }
              />
            </Card>

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
              <AssetField
                label="Solution image"
                preview={solutionImageUrl}
                onFile={(file) =>
                  void handleFile(file, setSolutionImageUrl, `solutions/${newGameId()}`)
                }
                onUrl={setSolutionImageUrl}
                showPreviewPanel
                previewLabel="Solution preview"
              />
            </Card>
          </>
        ) : null}
      </div>

      <FormSaveFooter onSave={() => void handleSave()} saving={saving} label="Save changes" />

      {installOpen && gameQuery.data ? (
        <InstallGameModal game={gameQuery.data} onClose={() => setInstallOpen(false)} />
      ) : null}
    </>
  )

  return children({
    headerTitle: `Edit ${GAME_TYPE_LABELS[gameType]}`,
    headerSubtitle: gameQuery.data.name,
    headerActions,
    body,
  })
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
      <div className="flex justify-start">
        <FlipSwitch
          caption="Points"
          offValue="static"
          onValue="range"
          offLabel="Static"
          onLabel="Range"
          value={pointsType}
          onChange={(next) => setPointsType(next)}
        />
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
