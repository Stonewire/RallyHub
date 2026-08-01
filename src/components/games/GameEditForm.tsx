import { IconEye } from '@/components/icons'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { AssetField } from '@/components/games/AssetField'
import { GameFormLayout } from '@/components/games/GameFormLayout'
import { QuizBackgroundPanel } from '@/components/games/QuizBackgroundPanel'
import { PhotoVideoFields } from '@/components/games/PhotoVideoFields'
import { PointsEditor } from '@/components/games/PointsEditor'
import { GamePreviewModal } from '@/components/games/GamePreviewModal'
import { InstallGameModal } from '@/components/rallyhub/InstallGameModal'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { PuzzleEditor, validatePuzzleConfig } from '@/components/games/PuzzleEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor, validateTextGameConfig } from '@/components/games/TextGameEditor'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useGameGroups, useSetGameGroups } from '@/hooks/use-game-groups'
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
  /** True in the side panel, which is far narrower than the viewport. */
  singleColumn?: boolean
  /** Shown as Cancel in the header. Omitted in the panel, which has a close. */
  onCancel?: () => void
  /** Called after a successful save. Route usage navigates away; panel usage can stay open. */
  onSaved?: () => void
  children: (render: GameEditFormRender) => ReactNode
}

/** Shared game-edit logic/fields, rendered by both the standalone edit page and the side panel. */
/**
 * Stable string form of everything the editor can change, for the dirty check.
 * JSON key order is insertion order, and every field is written here in a fixed
 * order, so the same values always produce the same string.
 */
function snapshot(values: Record<string, unknown>): string {
  return JSON.stringify(values)
}

export function GameEditForm({ gameId, onSaved, onCancel, singleColumn, children }: GameEditFormProps) {
  const organizationId = useAdminOrganizationId()
  const orgLoading = useAdminOrganizationLoading()
  const gameQuery = useGame(gameId)
  const gameGroupsQuery = useGameGroups(organizationId)
  const setGameGroups = useSetGameGroups(organizationId)
  const gameGroups = useMemo(() => gameGroupsQuery.data ?? [], [gameGroupsQuery.data])
  // Derived from the query, not mirrored in state: the checkbox writes through
  // immediately and the invalidation brings the new membership back, so there
  // is no second copy to keep in sync.
  const selectedGroupIds = useMemo(
    () =>
      new Set(
        gameGroups
          .filter((group) => group.items.some((item) => item.game_id === gameId))
          .map((group) => group.id),
      ),
    [gameGroups, gameId],
  )
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
  const [previewOpen, setPreviewOpen] = useState(false)
  // Snapshot of the game as loaded, so Save can be disabled until something
  // actually changes. The design's editor only offers Save when dirty.
  const baselineRef = useRef<string>('')
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
    baselineRef.current = snapshot({
      name: g.name,
      description: g.description ?? '',
      coverUrl: g.cover_url,
      config: c,
      pointsType: g.points_type,
      pointsStatic: g.points_static ?? 50,
      pointsMin: g.points_min ?? 10,
      pointsMax: g.points_max ?? 100,
      solutionDescription: g.solution_description ?? '',
      solutionImageUrl: g.solution_image_url,
      exampleVideoUrl: c.example_video_url ?? null,
      videoMaxMinutes: Math.floor(totalSeconds / 60),
      videoMaxSeconds: totalSeconds % 60,
    })
    setHydrated(true)
  }, [gameQuery.data, hydrated])


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

  const current = snapshot({
    name,
    description,
    coverUrl,
    config,
    pointsType,
    pointsStatic,
    pointsMin,
    pointsMax,
    solutionDescription,
    solutionImageUrl,
    exampleVideoUrl,
    videoMaxMinutes,
    videoMaxSeconds,
  })
  // eslint-disable-next-line react-hooks/refs -- baselineRef is only written in the hydrate effect; comparing during render is the intended dirty check
  const dirty = hydrated && current !== baselineRef.current

  const headerActions = (
    <>
      {/* Available for every game type, unlike the design which tucks Preview
          into the Facilitator Only card that photo and video alone render. */}
      <NeoButton type="button" variant="surface" onClick={() => setPreviewOpen(true)}>
        <IconEye className="size-3.5" aria-hidden />
        Preview
      </NeoButton>
      {isPlatformLibrary && gameQuery.data.is_platform_template ? (
        <Button type="button" variant="outline" onClick={() => setInstallOpen(true)}>
          Install to clients
        </Button>
      ) : null}
      {onCancel ? (
        <NeoButton type="button" variant="surface" onClick={onCancel}>
          Cancel
        </NeoButton>
      ) : null}
      <NeoButton
        type="button"
        variant="accent"
        disabled={saving || !dirty}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </NeoButton>
    </>
  )

  const groupsCard = (
    <Card className="border-border/80 flex min-h-0 flex-1 flex-col gap-3 bg-card p-6 shadow-sm">
      <h3 className="text-foreground text-sm font-bold">Groups</h3>
          <div className="space-y-2">
            <Label>Groups</Label>
            {gameGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No groups yet. Create one from the Games library.
              </p>
            ) : (
              <div className="border-border min-h-32 flex-1 space-y-1 overflow-auto rounded-md border p-2">
                {gameGroups.map((group) => (
                  <label
                    key={group.id}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.has(group.id)}
                      onChange={() => {
                        const next = new Set(selectedGroupIds)
                        if (next.has(group.id)) next.delete(group.id)
                        else next.add(group.id)
                        void setGameGroups
                          .mutateAsync({ gameId, groupIds: [...next] })
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : 'Could not update groups'),
                          )
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
    </Card>
  )

  const designerCard =
    gameType === 'text' ? (
      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <h3 className="text-foreground text-sm font-bold">Game designer</h3>
        <TextGameEditor
          config={config}
          setConfig={setConfig}
          judged={pointsType === 'range'}
          section="designer"
        />
      </Card>
    ) : gameType === 'puzzle' ? (
      <PuzzleEditor config={config} setConfig={setConfig} section="designer" />
    ) : null

  const body = (
    <>
      <GamePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        gameType={gameType}
        name={name}
        coverUrl={coverUrl}
        config={config}
      />
      {error ? (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        {gameType === 'photo' || gameType === 'video' ? (
          <PhotoVideoFields
            gameType={gameType}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
            onUploadCover={(file) => uploadGameFile(organizationId, `covers/${gameId}`, file)}
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
            onUploadVideo={(file) => uploadGameFile(organizationId, `videos/${newGameId()}`, file)}
            videoMaxMinutes={videoMaxMinutes}
            setVideoMaxMinutes={setVideoMaxMinutes}
            videoMaxSeconds={videoMaxSeconds}
            setVideoMaxSeconds={setVideoMaxSeconds}
            solutionDescription={solutionDescription}
            setSolutionDescription={setSolutionDescription}
            solutionImageUrl={solutionImageUrl}
            setSolutionImageUrl={setSolutionImageUrl}
            onUploadSolution={(file) => uploadGameFile(organizationId, `solutions/${newGameId()}`, file)}
            config={config}
            setConfig={setConfig}
            singleColumn={singleColumn}
            groupsCard={groupsCard}
          />
        ) : null}

        {gameType === 'photo' || gameType === 'video' ? null : (
          <GameFormLayout
            facilitatorCard={
              gameType === 'quiz' ? (
                <QuizBackgroundPanel
                  config={config}
                  setConfig={setConfig}
                  quizName={name}
                  onUploadBackground={(file) =>
                    uploadGameFile(organizationId, `backgrounds/${gameId}`, file)
                  }
                />
              ) : (
                designerCard
              )
            }
            groupsCard={groupsCard}
            singleColumn={singleColumn}
            evenColumns={gameType === 'quiz'}
            below={
              gameType === 'quiz' ? (
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
              ) : null
            }
          >
        {gameType === 'quiz' ? null : (
        <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <h3 className="text-foreground text-sm font-bold">Primary settings</h3>
          <div className="space-y-2">
            <Label>Game name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          {gameType === 'text' || gameType === 'puzzle' ? (
            <>
              <AssetField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  setCoverUrl(await uploadGameFile(organizationId, `covers/${gameId}`, file))
                }}
                onUrl={setCoverUrl}
                showPreviewPanel
              />
              {gameType === 'text' ? (
                <>
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
                  <TextGameEditor config={config} setConfig={setConfig} section="settings" />
                </>
              ) : (
                <>
                  <div className="flex w-full items-center gap-3">
                    <Label className="shrink-0">Maximum points</Label>
                    <Input
                      type="number"
                      min={1}
                      value={pointsStatic}
                      onChange={(e) => setPointsStatic(Math.max(1, Number(e.target.value) || 1))}
                      className="bg-background h-8 w-24"
                    />
                    <span className="text-muted-foreground text-xs">
                      Reduced by the puzzle scoring rule.
                    </span>
                  </div>
                  <PuzzleEditor config={config} setConfig={setConfig} section="settings" />
                </>
              )}
            </>
          ) : null}
        </Card>
        )}

        {gameType === 'quiz' ? (
          <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
            <h3 className="text-foreground text-sm font-bold">Primary settings</h3>
            <div className="space-y-2">
              <Label>Quiz name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor value={description} onChange={setDescription} />
            </div>
            <AssetField
              label="Cover image"
              preview={coverUrl}
              onFile={async (file) => {
                if (!file) return
                setCoverUrl(await uploadGameFile(organizationId, `covers/${gameId}`, file))
              }}
              onUrl={setCoverUrl}
              showPreviewPanel
            />
            <div className="flex w-full items-center gap-3">
              <Label className="w-40 shrink-0">Points / correct</Label>
              <Input
                type="number"
                min={0}
                value={pointsStatic}
                onChange={(e) => setPointsStatic(Math.max(0, Number(e.target.value) || 0))}
                className="bg-background h-8 w-24"
              />
            </div>
            <div className="flex w-full items-center gap-3">
              <Label className="w-40 shrink-0">Time / question</Label>
              <Input
                type="number"
                min={5}
                value={config.timer_seconds ?? 20}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    timer_seconds: Math.max(5, Number(e.target.value) || 5),
                  }))
                }
                className="bg-background h-8 w-24"
              />
              <span className="text-muted-foreground text-xs">seconds</span>
            </div>
          </Card>
        ) : null}

        {gameType === 'music_bingo' ? (
          <MusicBingoEditor
            config={config}
            setConfig={setConfig}
            organizationId={organizationId}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
            gameName={name}
          />
        ) : null}


          </GameFormLayout>
        )}
      </div>


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

