import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { AssetField } from '@/components/games/AssetField'
import { GameFormLayout } from '@/components/games/GameFormLayout'
import { MusicBingoEditor } from '@/components/games/MusicBingoEditor'
import { PhotoVideoFields } from '@/components/games/PhotoVideoFields'
import { PointsEditor } from '@/components/games/PointsEditor'
import { PuzzleEditor } from '@/components/games/PuzzleEditor'
import { QuizBackgroundPanel } from '@/components/games/QuizBackgroundPanel'
import { QuizEditor } from '@/components/games/QuizEditor'
import { TextGameEditor } from '@/components/games/TextGameEditor'
import { moveTargets, questionsInRound, removeRound } from '@/components/games/quiz-round-edits'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { newGameId, uploadGameFile } from '@/lib/game-upload'
import type { GameType, PointsType } from '@/types/database'
import type { GameConfig } from '@/types/game-config'

export type GameFieldsProps = {
  gameType: GameType
  organizationId: string
  /** Folder key for uploads: the game id when editing, a fresh id when creating. */
  assetId: string
  name: string
  setName: (value: string) => void
  description: string
  setDescription: (value: string) => void
  coverUrl: string | null
  setCoverUrl: (value: string | null) => void
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  pointsType: PointsType
  setPointsType: (value: PointsType) => void
  pointsStatic: number
  setPointsStatic: (value: number) => void
  pointsMin: number
  setPointsMin: (value: number) => void
  pointsMax: number
  setPointsMax: (value: number) => void
  exampleVideoUrl: string | null
  setExampleVideoUrl: (value: string | null) => void
  videoMaxMinutes: number
  setVideoMaxMinutes: (value: number) => void
  videoMaxSeconds: number
  setVideoMaxSeconds: (value: number) => void
  solutionDescription: string
  setSolutionDescription: (value: string) => void
  solutionImageUrl: string | null
  setSolutionImageUrl: (value: string | null) => void
  /** Group picker, which differs: editing writes through, creating waits for save. */
  groupsCard: ReactNode
  /** True in the side panel, which is far narrower than the viewport. */
  singleColumn?: boolean
}

/**
 * Every field of every game type, laid out once.
 *
 * Creating and editing render this same component. They used to carry their own
 * copies, which drifted every time one of them was worked on: the quiz redesign
 * landed on the editor and left the create screen on the old layout.
 */
export function GameFields({
  gameType,
  organizationId,
  assetId,
  name,
  setName,
  description,
  setDescription,
  coverUrl,
  setCoverUrl,
  config,
  setConfig,
  pointsType,
  setPointsType,
  pointsStatic,
  setPointsStatic,
  pointsMin,
  setPointsMin,
  pointsMax,
  setPointsMax,
  exampleVideoUrl,
  setExampleVideoUrl,
  videoMaxMinutes,
  setVideoMaxMinutes,
  videoMaxSeconds,
  setVideoMaxSeconds,
  solutionDescription,
  setSolutionDescription,
  solutionImageUrl,
  setSolutionImageUrl,
  groupsCard,
  singleColumn,
}: GameFieldsProps) {
  const { t } = useTranslation('admin')
  const [deleteRoundId, setDeleteRoundId] = useState<string | null>(null)
  const [moveTargetId, setMoveTargetId] = useState<string>('')

  const designerCard =
    gameType === 'text' ? (
      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <h3 className="text-foreground text-sm font-bold">{t('games.gameDesigner')}</h3>
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

  /**
   * Rounds follow this number. Adding appends empty rounds; reducing removes
   * from the end, but only empty ones. A round holding questions has to be
   * deleted from its own card, where the questions can be moved somewhere else
   * first, so a typo here can never destroy work.
   */
  function setRoundCount(next: number) {
    const target = Math.max(1, Math.min(20, next))
    setConfig((current) => {
      const rounds = current.rounds ?? []
      if (target === rounds.length) return current
      if (target > rounds.length) {
        const added = Array.from({ length: target - rounds.length }, (_, i) => ({
          id: newGameId(),
          name: `Round ${rounds.length + i + 1}`,
          questionIds: [],
        }))
        return { ...current, rounds_enabled: true, rounds: [...rounds, ...added] }
      }
      const doomed = rounds.slice(target)
      const firstWithQuestions = doomed.find((round) =>
        (current.questions ?? []).some((q) => q.roundId === round.id),
      )
      // A round holding questions goes through the same dialog as its own
      // delete button, so the questions can be rehomed rather than vanishing
      // because a number was typed. Empty rounds just go.
      if (firstWithQuestions) {
        setDeleteRoundId(firstWithQuestions.id)
        return current
      }
      return { ...current, rounds_enabled: true, rounds: rounds.slice(0, target) }
    })
  }

  const roundBeingDeleted = (config.rounds ?? []).find((r) => r.id === deleteRoundId) ?? null
  const doomedQuestions = deleteRoundId ? questionsInRound(config, deleteRoundId) : []

  function confirmDeleteRound() {
    if (!deleteRoundId) return
    setConfig((current) => removeRound(current, deleteRoundId, moveTargetId || null))
    setDeleteRoundId(null)
    setMoveTargetId('')
  }

  return (
    <>
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
            onUploadCover={(file) => uploadGameFile(organizationId, `covers/${assetId}`, file)}
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
            onUploadSolution={(file) =>
              uploadGameFile(organizationId, `solutions/${newGameId()}`, file)
            }
            config={config}
            setConfig={setConfig}
            singleColumn={singleColumn}
            groupsCard={groupsCard}
          />
        ) : (
          <GameFormLayout
            facilitatorCard={
              gameType === 'music_bingo' ? (
                <QuizBackgroundPanel
                  config={config}
                  setConfig={setConfig}
                  quizName={name}
                  title={t('games.bingoDesigner')}
                  previewSubtitle={t('games.bingoPreviewSubtitle')}
                  onUploadBackground={(file) =>
                    uploadGameFile(organizationId, `bingo/bg-${assetId}`, file)
                  }
                />
              ) : gameType === 'quiz' ? (
                <QuizBackgroundPanel
                  config={config}
                  setConfig={setConfig}
                  quizName={name}
                  onUploadBackground={(file) =>
                    uploadGameFile(organizationId, `backgrounds/${assetId}`, file)
                  }
                />
              ) : (
                designerCard
              )
            }
            groupsCard={groupsCard}
            singleColumn={singleColumn}
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
              ) : gameType === 'quiz' ? (
                <QuizEditor
                  config={config}
                  setConfig={setConfig}
                  organizationId={organizationId}
                  // assetId is the game id when editing; when creating it is a
                  // fresh id that matches nothing, so nothing is excluded.
                  gameId={assetId}
                  onDeleteRound={(roundId) => setDeleteRoundId(roundId)}
                  // Returns the URL; QuestionMedia writes it to the right field
                  // for the kind that is selected.
                  onUploadQuestionPhoto={(questionId, file) =>
                    uploadGameFile(organizationId, `quiz/q-${questionId}`, file)
                  }
                />
              ) : null
            }
          >
            {gameType === 'quiz' ? (
              <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
                <h3 className="text-foreground text-sm font-bold">{t('games.primarySettings')}</h3>
                <div className="space-y-2">
                  <Label>{t('games.quizName')}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('games.description')}</Label>
                  <RichTextEditor value={description} onChange={setDescription} />
                </div>
                <AssetField
                  label={t('games.coverImage')}
                cropCover
                  preview={coverUrl}
                  onFile={async (file) => {
                    if (!file) return
                    setCoverUrl(await uploadGameFile(organizationId, `covers/${assetId}`, file))
                  }}
                  onUrl={setCoverUrl}
                  showPreviewPanel
                />
                {/* Side by side with the label above each: three short numbers
                    do not need a row apiece. */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="quiz-points">{t('games.pointsPerCorrect')}</Label>
                    <NumberField
                      id="quiz-points"
                      min={0}
                      value={pointsStatic}
                      onChange={setPointsStatic}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quiz-timer">{t('games.timePerQuestion')}</Label>
                    <NumberField
                      id="quiz-timer"
                      min={5}
                      value={config.timer_seconds ?? 20}
                      onChange={(n) => setConfig((c) => ({ ...c, timer_seconds: n }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quiz-rounds">{t('games.rounds')}</Label>
                    <NumberField
                      id="quiz-rounds"
                      min={1}
                      value={(config.rounds ?? []).length || 1}
                      onChange={setRoundCount}
                      className="bg-background"
                    />
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
                <h3 className="text-foreground text-sm font-bold">{t('games.primarySettings')}</h3>
                <div className="space-y-2">
                  <Label>{t('games.gameName')}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('games.description')}</Label>
                  <RichTextEditor value={description} onChange={setDescription} />
                </div>
                {gameType === 'music_bingo' ? (
                  <MusicBingoEditor
                    config={config}
                    setConfig={setConfig}
                    organizationId={organizationId}
                    coverUrl={coverUrl}
                    setCoverUrl={setCoverUrl}
                    gameName={name}
                    section="settings"
                  />
                ) : null}
                {gameType === 'text' || gameType === 'puzzle' ? (
                  <>
                    <AssetField
                      label={t('games.coverImage')}
                cropCover
                      preview={coverUrl}
                      onFile={async (file) => {
                        if (!file) return
                        setCoverUrl(await uploadGameFile(organizationId, `covers/${assetId}`, file))
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
                          <Label className="shrink-0">{t('games.maximumPoints')}</Label>
                          <NumberField
                            min={1}
                            value={pointsStatic}
                            onChange={setPointsStatic}
                            className="bg-background h-8 w-24"
                          />
                          <span className="text-muted-foreground text-xs">
                            {t('games.puzzleScoringHint')}
                          </span>
                        </div>
                        <PuzzleEditor config={config} setConfig={setConfig} section="settings" />
                      </>
                    )}
                  </>
                ) : null}
              </Card>
            )}
          </GameFormLayout>
        )}
      </div>

      {roundBeingDeleted ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <Card className="border-border/80 w-full max-w-md space-y-4 bg-card p-6 shadow-xl">
            <h3 className="text-foreground font-semibold">
              {t('games.deleteRoundTitle', {
                name: roundBeingDeleted.name || t('games.thisRound'),
              })}
            </h3>
            {doomedQuestions.length > 0 ? (
              <>
                <p className="text-muted-foreground text-sm">
                  {t('games.roundHoldsQuestions', { count: doomedQuestions.length })}
                </p>
                <select
                  value={moveTargetId}
                  onChange={(event) => setMoveTargetId(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  <option value="">{t('games.deleteTheQuestions')}</option>
                  {moveTargets(config, roundBeingDeleted.id).map((round) => (
                    <option key={round.id} value={round.id}>
                      {t('games.moveToRound', {
                        name: round.name || t('games.unnamedRound'),
                      })}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t('games.roundIsEmpty')}</p>
            )}
            <div className="flex justify-end gap-2">
              <NeoButton
                variant="surface"
                onClick={() => {
                  setDeleteRoundId(null)
                  setMoveTargetId('')
                }}
              >
                {t('common:cancel')}
              </NeoButton>
              <NeoButton variant="destructive" onClick={confirmDeleteRound}>
                {t('games.deleteRound')}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  )
}
