import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { InstallGameModal } from '@/components/rallyhub/InstallGameModal'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor, validateTextGameConfig } from '@/components/games/TextGameEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { GAME_TYPE_LABELS, useGame, useUpdateGame } from '@/hooks/use-games'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import { sanitizeRichText } from '@/lib/rich-text'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import type { GameType, PointsType } from '@/types/database'
import type { GameConfig } from '@/types/game-config'

export function AdminGameEditPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const organizationId = useAdminOrganizationId()
  const orgLoading = useAdminOrganizationLoading()
  const gameQuery = useGame(gameId)
  const updateGame = useUpdateGame(organizationId)

  const [hydrated, setHydrated] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [config, setConfig] = useState<GameConfig>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const isPlatformLibrary = useIsPlatformGamesAdmin()

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

  if (orgLoading) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <QueryLoading rows={6} />
      </AdminPageShell>
    )
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  if (gameQuery.isLoading || !hydrated) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <QueryLoading rows={6} />
      </AdminPageShell>
    )
  }

  if (gameQuery.isError || !gameQuery.data) {
    return (
      <AdminPageShell title="Edit game" backTo="/admin/games" backLabel="Back to games">
        <QueryError message={gameQuery.error?.message ?? 'Game not found'} />
      </AdminPageShell>
    )
  }

  const gameType = gameQuery.data.type as GameType
  const tracks = config.tracks ?? []

  async function handleSave() {
    if (!gameId || !name.trim()) {
      setError('Game name is required.')
      return
    }
    if (gameType === 'music_bingo' && tracks.length < 5) {
      setError('Music bingo needs at least 5 tracks.')
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
      const isPhotoVideo = gameType === 'photo' || gameType === 'video'
      await updateGame.mutateAsync({
        gameId,
        patch: {
          name: name.trim(),
          description: description ? sanitizeRichText(description) : null,
          cover_url: coverUrl,
          ...(isPhotoVideo
            ? {
                points_type: pointsType,
                points_static: pointsType === 'static' ? pointsStatic : null,
                points_min: pointsType === 'range' ? pointsMin : null,
                points_max: pointsType === 'range' ? pointsMax : null,
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
                : config,
        },
      })
      navigate('/admin/games', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPageShell
      title={`Edit ${GAME_TYPE_LABELS[gameType]}`}
      subtitle={gameQuery.data.name}
      backTo="/admin/games"
      backLabel="Back to games"
      actions={
        <>
          {isPlatformLibrary && gameQuery.data.is_platform_template ? (
            <Button type="button" variant="outline" onClick={() => setInstallOpen(true)}>
              Install to clients
            </Button>
          ) : null}
          <NeoButton type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save changes'}
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
              <FileField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadGameFile(organizationId, `covers/${gameId}`, file)
                  setCoverUrl(url)
                }}
              />
            </Card>
            <TextGameEditor config={config} setConfig={setConfig} />
          </>
        ) : null}

        {gameType === 'photo' || gameType === 'video' ? (
          <>
            <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
              <FileField
                label="Cover image"
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadGameFile(organizationId, `covers/${gameId}`, file)
                  setCoverUrl(url)
                }}
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
                      Stored as {Math.max(1, videoMaxMinutes * 60 + videoMaxSeconds)} seconds
                      total
                    </p>
                  </div>
                  <FileField
                    label="Example video (visible to participants)"
                    accept="video/*"
                    preview={exampleVideoUrl}
                    onFile={(file) =>
                      void handleFile(file, setExampleVideoUrl, `videos/${newGameId()}`)
                    }
                  />
                </>
              ) : null}
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
              <FileField
                label="Solution image"
                preview={solutionImageUrl}
                onFile={(file) =>
                  void handleFile(file, setSolutionImageUrl, `solutions/${newGameId()}`)
                }
              />
            </Card>
          </>
        ) : null}
      </div>

      <FormSaveFooter onSave={() => void handleSave()} saving={saving} label="Save changes" />

      {installOpen && gameQuery.data ? (
        <InstallGameModal
          game={gameQuery.data}
          onClose={() => setInstallOpen(false)}
        />
      ) : null}
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
  onFile: (file: File | undefined) => void | Promise<void>
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
