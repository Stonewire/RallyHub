import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import {
  IconMusicBingo,
  IconPhoto,
  IconPuzzle,
  IconQuiz,
  IconText,
  IconVideo,
} from '@/components/icons'
import { useGameGroups, useSetGameGroups } from '@/hooks/use-game-groups'
import { NeoButton } from '@/components/neo-minimal'
import { QueryLoading } from '@/components/admin/QueryState'
import { GameFields } from '@/components/games/GameFields'
import { validatePuzzleConfig } from '@/components/games/PuzzleEditor'
import { validateTextGameConfig } from '@/components/games/TextGameEditor'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { Card } from '@/components/ui/card'
import { useCreateGame } from '@/hooks/use-games'
import {
  useAdminOrganizationId,
  useAdminOrganizationLoading,
} from '@/hooks/use-organization-id'
import { useIsPlatformGamesAdmin } from '@/hooks/use-platform-library'
import { newGameId } from '@/lib/game-upload'
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

function defaultGameName(type: GameType | null): string {
  if (type === 'quiz') return 'New Quiz'
  if (type === 'music_bingo') return 'Music Bingo'
  if (type === 'text') return 'New Text Challenge'
  if (type === 'puzzle') return 'New Puzzle'
  return ''
}

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
  // Uploads need a folder before the row exists, so the id is minted up front.
  const [draftAssetId] = useState(() => newGameId())

  // The type comes from the picker modal. Landing here without one (a stale
  // link, a typed URL) sends the organiser back to the library, where the
  // picker lives, rather than showing a second copy of it.
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get('type')
  const initialType = TYPES.some((t) => t.type === requestedType)
    ? (requestedType as GameType)
    : null
  const gameType = initialType
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared / photo / video
  const [name, setName] = useState(() => defaultGameName(initialType))
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
          example_video_url:
            gameType === 'photo' || gameType === 'video' ? exampleVideoUrl : undefined,
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

  if (!gameType) return <Navigate to="/admin/games" replace />

  // Groups are held locally until save, since there is no game row to attach
  // them to yet. Editing writes through instead.
  const groupsCard = (
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
  )

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

      <GameFields
        gameType={gameType}
        organizationId={organizationId}
        assetId={draftAssetId}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        coverUrl={coverUrl}
        setCoverUrl={setCoverUrl}
        config={config}
        setConfig={setConfig}
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
        videoMaxMinutes={videoMaxMinutes}
        setVideoMaxMinutes={setVideoMaxMinutes}
        videoMaxSeconds={videoMaxSeconds}
        setVideoMaxSeconds={setVideoMaxSeconds}
        solutionDescription={solutionDescription}
        setSolutionDescription={setSolutionDescription}
        solutionImageUrl={solutionImageUrl}
        setSolutionImageUrl={setSolutionImageUrl}
        groupsCard={groupsCard}
      />

    </AdminPageShell>
  )
}
