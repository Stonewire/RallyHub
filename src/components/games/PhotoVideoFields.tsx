import { AssetField } from '@/components/games/AssetField'
import { PointsEditor } from '@/components/games/PointsEditor'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import type { GameConfig } from '@/types/game-config'
import type { GameType, PointsType } from '@/types/database'

export type PhotoVideoFieldsProps = {
  gameType: GameType
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  coverUrl: string | null
  setCoverUrl: (v: string | null) => void
  onUploadCover: (file: File) => Promise<string>
  pointsType: PointsType
  setPointsType: (v: PointsType) => void
  pointsStatic: number
  setPointsStatic: (v: number) => void
  pointsMin: number
  setPointsMin: (v: number) => void
  pointsMax: number
  setPointsMax: (v: number) => void
  exampleVideoUrl: string | null
  setExampleVideoUrl: (v: string | null) => void
  onUploadVideo: (file: File) => Promise<string>
  videoMaxMinutes: number
  setVideoMaxMinutes: (v: number) => void
  videoMaxSeconds: number
  setVideoMaxSeconds: (v: number) => void
  solutionDescription: string
  setSolutionDescription: (v: string) => void
  solutionImageUrl: string | null
  setSolutionImageUrl: (v: string | null) => void
  onUploadSolution: (file: File) => Promise<string>
  config: GameConfig
  setConfig: React.Dispatch<React.SetStateAction<GameConfig>>
  /** Edit only: a game must exist before it can join a group. */
  groupsCard?: React.ReactNode
}

/**
 * The photo and video game form, shared by creating and editing.
 *
 * It exists because those two screens had grown separate copies of the same
 * fields, which is how the create page ended up with a raw file input and no
 * two-column layout while the edit page had both. One definition, one place to
 * change.
 */
export function PhotoVideoFields(props: PhotoVideoFieldsProps) {
  const {
    gameType, name, setName, description, setDescription,
    coverUrl, setCoverUrl, onUploadCover,
    pointsType, setPointsType, pointsStatic, setPointsStatic,
    pointsMin, setPointsMin, pointsMax, setPointsMax,
    exampleVideoUrl, setExampleVideoUrl, onUploadVideo,
    videoMaxMinutes, setVideoMaxMinutes, videoMaxSeconds, setVideoMaxSeconds,
    solutionDescription, setSolutionDescription,
    solutionImageUrl, setSolutionImageUrl, onUploadSolution,
    config, setConfig, groupsCard,
  } = props

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[2fr_1fr]">
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
                preview={coverUrl}
                onFile={async (file) => {
                  if (!file) return
                  setCoverUrl(await onUploadCover(file))
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
              {gameType === 'video' ? (
                <AssetField
                  label="Example video (visible to participants)"
                  accept="video/*"
                  preview={exampleVideoUrl}
                  onFile={async (file) => {
                    if (!file) return
                    setExampleVideoUrl(await onUploadVideo(file))
                  }}
                  onUrl={setExampleVideoUrl}
                  urlPlaceholder="or paste a YouTube link…"
                />
              ) : (
                /* Link only on a photo game: the field is for pointing at a
                   YouTube video, and an upload control invites a file that has
                   nowhere useful to go. */
                <div className="space-y-2">
                  <Label>Instructional video link (optional, visible to participants)</Label>
                  <Input
                    value={exampleVideoUrl ?? ''}
                    placeholder="https://youtube.com/…"
                    onChange={(event) => setExampleVideoUrl(event.target.value.trim() || null)}
                    className="bg-background"
                  />
                  <p className="text-muted-foreground text-xs">
                    YouTube link. Unlisted is fine; private videos will not play
                    for participants.
                  </p>
                </div>
              )}
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
              {gameType === 'video' ? (
                <div className="space-y-2">
                  <Label>Solution video link</Label>
                  <Input
                    value={config.solution_video_url ?? ''}
                    placeholder="https://…"
                    onChange={(event) =>
                      setConfig((c) => ({
                        ...c,
                        solution_video_url: event.target.value.trim() || null,
                      }))
                    }
                    className="bg-background"
                  />
                  <p className="text-muted-foreground text-xs">
                    Facilitators only. Stripped from the live payload, so
                    players never receive it.
                  </p>
                </div>
              ) : null}
              <AssetField
                label="Solution image"
                preview={solutionImageUrl}
                onFile={async (file) => {
                  if (!file) return
                  setSolutionImageUrl(await onUploadSolution(file))
                }}
                onUrl={setSolutionImageUrl}
                showPreviewPanel
                previewLabel="Solution preview"
              />
            </Card>
      {groupsCard}
    </div>
  )
}
