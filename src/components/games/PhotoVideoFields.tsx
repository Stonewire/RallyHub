import { AssetField } from '@/components/games/AssetField'
import { PointsEditor } from '@/components/games/PointsEditor'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import { youTubeEmbedUrl } from '@/lib/video-embed'
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
  groupsCard?: React.ReactNode
  /**
   * Forces one column. The side panel is ~35rem wide but xl: keys off the
   * viewport, so on a wide screen the panel was splitting into two columns
   * inside its own narrow box.
   */
  singleColumn?: boolean
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
    config, setConfig, groupsCard, singleColumn,
  } = props

  return (
    <div
      className={
        singleColumn
          ? 'space-y-6'
          : 'grid items-stretch gap-6 xl:grid-cols-[2fr_1fr]'
      }
    >
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
                cropCover
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
                /* Label and both boxes on one line, like Points. The total in
                   seconds was restating the two numbers above it. */
                <div className="flex w-full flex-wrap items-center gap-3">
                  <Label className="shrink-0">Max video duration</Label>
                  <div className="flex items-center gap-2">
                    <NumberField
                      min={0}
                      max={59}
                      aria-label="Minutes"
                      value={videoMaxMinutes}
                      onChange={setVideoMaxMinutes}
                      className="bg-background h-8 w-20"
                    />
                    <span className="text-muted-foreground text-sm">min</span>
                    <NumberField
                      min={0}
                      max={59}
                      aria-label="Seconds"
                      value={videoMaxSeconds}
                      onChange={setVideoMaxSeconds}
                      className="bg-background h-8 w-20"
                    />
                    <span className="text-muted-foreground text-sm">sec</span>
                  </div>
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
                  {/* The same player participants get, so the organiser sees
                      whether the link actually works (CF3-2). */}
                  {youTubeEmbedUrl(exampleVideoUrl) ? (
                    <iframe
                      src={youTubeEmbedUrl(exampleVideoUrl)!}
                      title="Video preview"
                      className="aspect-video w-full max-w-md rounded-lg"
                      allow="encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : null}
                </div>
              )}
            </Card>

            <div className="flex flex-col gap-6">
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
    </div>
  )
}
