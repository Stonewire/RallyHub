import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  IconMusicBingo,
  IconPhoto,
  IconPuzzle,
  IconQuiz,
  IconText,
  IconVideo,
} from '@/components/icons'
import { useGameGroups, useSetGameGroups } from '@/hooks/use-game-groups'
import { GameFormLayout } from '@/components/games/GameFormLayout'
import { QuizBackgroundPanel } from '@/components/games/QuizBackgroundPanel'
import { AssetField } from '@/components/games/AssetField'
import { PointsEditor } from '@/components/games/PointsEditor'
import { PhotoVideoFields } from '@/components/games/PhotoVideoFields'
import { NeoButton } from '@/components/neo-minimal'
import { QueryLoading } from '@/components/admin/QueryState'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { PuzzleEditor, validatePuzzleConfig } from '@/components/games/PuzzleEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor, validateTextGameConfig } from '@/components/games/TextGameEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
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
  const gameGroupsQuery = useGameGroups(organizationId)
  const setGameGroups = useSetGameGroups(organizationId)
  const availableGroups = useMemo(() => gameGroupsQuery.data ?? [], [gameGroupsQuery.data])
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())

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
      const created = await createGame.mutateAsync({
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
      // Groups are applied after the insert because a membership row needs the
      // game's id. Failing here must not read as "the game was not created", so
      // it reports separately and leaves the game in place.
      if (created?.id && selectedGroupIds.size > 0) {
        try {
          await setGameGroups.mutateAsync({
            gameId: created.id,
            groupIds: [...selectedGroupIds],
          })
        } catch {
          setError('Game saved, but its groups could not be set. Add them from the editor.')
          setSaving(false)
          return
        }
      }
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
      actions={
        <>
          <NeoButton type="button" variant="surface" onClick={() => navigate('/admin/games')}>
            Cancel
          </NeoButton>
          <NeoButton type="button" variant="accent" disabled={saving} onClick={() => void handleSave()}>
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
            groupsCard={
              <Card className="border-border/80 flex min-h-0 flex-1 flex-col gap-3 bg-card p-6 shadow-sm">
                <h3 className="text-foreground text-sm font-bold">Groups</h3>
                {availableGroups.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No groups yet. Create one from the Games library.
                  </p>
                ) : (
                  <div className="min-h-[17rem] flex-1 space-y-0.5 overflow-auto">
                    {availableGroups.map((group) => (
                      <label
                        key={group.id}
                        className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.has(group.id)}
                          onChange={() =>
                            setSelectedGroupIds((current) => {
                              const next = new Set(current)
                              if (next.has(group.id)) next.delete(group.id)
                              else next.add(group.id)
                              return next
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </Card>
            }
          />
        )}
        {!isPhotoVideo && (
          <GameFormLayout
            evenColumns={gameType === 'quiz' || gameType === 'music_bingo'}
            below={
              gameType === 'music_bingo' ? (
                <MusicBingoEditor
                  config={config}
                  setConfig={setConfig}
                  organizationId={organizationId}
                  coverUrl={coverUrl}
                  setCoverUrl={setCoverUrl}
                  gameName={name}
                  section="tracks"
                />
              ) : null
            }
            facilitatorCard={
              gameType === 'music_bingo' ? (
                <QuizBackgroundPanel
                  config={config}
                  setConfig={setConfig}
                  quizName={name}
                  title="Bingo designer"
                  previewSubtitle="Listen and mark your card"
                  onUploadBackground={(file) =>
                    uploadGameFile(organizationId!, `bingo/bg-${newGameId()}`, file)
                  }
                />
              ) : isText ? (
                <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
                  <h3 className="text-foreground text-sm font-bold">Game designer</h3>
                  <TextGameEditor
                    config={config}
                    setConfig={setConfig}
                    judged={pointsType === 'range'}
                    section="designer"
                  />
                </Card>
              ) : isPuzzle ? (
                <PuzzleEditor config={config} setConfig={setConfig} section="designer" />
              ) : null
            }
            groupsCard={
            <Card className="border-border/80 flex min-h-0 flex-1 flex-col gap-3 bg-card p-6 shadow-sm">
              <h3 className="text-foreground text-sm font-bold">Groups</h3>
              {availableGroups.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No groups yet. Create one from the Games library.
                </p>
              ) : (
                <div className="min-h-[17rem] flex-1 space-y-0.5 overflow-auto">
                  {availableGroups.map((group) => (
                    <label
                      key={group.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(group.id)}
                        onChange={() =>
                          setSelectedGroupIds((current) => {
                            const next = new Set(current)
                            if (next.has(group.id)) next.delete(group.id)
                            else next.add(group.id)
                            return next
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </Card>
            }
          >

        {isText && (
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
            <AssetField
              label="Cover image"
              onFile={(f) => void handleFile(f, setCoverUrl, `covers/${newGameId()}`)}
              onUrl={setCoverUrl}
              preview={coverUrl}
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
            <TextGameEditor config={config} setConfig={setConfig} section="settings" />
          </Card>
        )}

        {isPuzzle && (
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
            <AssetField
              label="Cover image"
              onFile={(f) => void handleFile(f, setCoverUrl, `covers/${newGameId()}`)}
              onUrl={setCoverUrl}
              preview={coverUrl}
              showPreviewPanel
            />
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
          </Card>
        )}

        {gameType === 'quiz' && (
          <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
            <h3 className="text-foreground text-sm font-bold">Primary settings</h3>
            <div className="space-y-2">
              <Label>Game name</Label>
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
              onUploadQuestionPhoto={(questionId, file) =>
                uploadGameFile(organizationId, `quiz/q-${questionId}`, file)
              }
            />
          </Card>
        )}

        {gameType === 'music_bingo' && (
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
            <MusicBingoEditor
              config={config}
              setConfig={setConfig}
              organizationId={organizationId}
              coverUrl={coverUrl}
              setCoverUrl={setCoverUrl}
              gameName={name}
              section="settings"
            />
          </Card>
        )}
          </GameFormLayout>
        )}
      </div>

    </AdminPageShell>
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


